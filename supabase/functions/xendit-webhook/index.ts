import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Callback-Token",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const webhookToken = req.headers.get("x-callback-token");
    const payload = await req.json();

    console.log("Xendit webhook received:", JSON.stringify(payload, null, 2));

    const invoiceId = payload.id;
    const externalId = payload.external_id;
    const status = payload.status;
    const paidAt = payload.paid_at;
    const paymentChannel = payload.payment_channel;
    const paymentMethod = payload.payment_method;

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: "Missing invoice ID" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: payments } = await supabase
      .from("payments")
      .select("id, company_id, payment_status, quotation_id, proforma_invoice_id, amount")
      .eq("transaction_id", invoiceId)
      .limit(1);

    if (!payments || payments.length === 0) {
      console.log("Payment not found for invoice:", invoiceId);
      return new Response(
        JSON.stringify({ message: "Payment not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payment = payments[0];

    if (payment.payment_status === "paid" && status === "PAID") {
      console.log("Payment already marked as paid, skipping (idempotency)");
      return new Response(
        JSON.stringify({ success: true, message: "Already processed" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: gatewayConfig } = await supabase
      .from("payment_gateway_configs")
      .select("config")
      .eq("company_id", payment.company_id)
      .eq("provider", "xendit")
      .maybeSingle();

    if (gatewayConfig?.config?.webhook_secret) {
      if (webhookToken !== gatewayConfig.config.webhook_secret) {
        console.log("Invalid webhook token");
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    let paymentStatus = "pending";
    if (status === "PAID" || status === "SETTLED") {
      paymentStatus = "paid";
    } else if (status === "EXPIRED") {
      paymentStatus = "expired";
    } else if (status === "FAILED") {
      paymentStatus = "failed";
    }

    const updateData: any = {
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    };

    if (paymentStatus === "paid") {
      updateData.verification_status = "verified";
      updateData.verification_type = "auto";
      updateData.paid_at = paidAt || new Date().toISOString();
      updateData.provider_ref = externalId;
      updateData.verified_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("payments")
      .update(updateData)
      .eq("id", payment.id);

    if (updateError) {
      console.error("Error updating payment:", updateError);
      throw updateError;
    }

    if (paymentStatus === "paid") {
      if (payment.quotation_id) {
        const { data: allPayments } = await supabase
          .from("payments")
          .select("amount")
          .eq("quotation_id", payment.quotation_id)
          .eq("payment_status", "paid")
          .neq("verification_status", "rejected");

        const { data: quotation } = await supabase
          .from("quotations")
          .select("total_amount, customer_name")
          .eq("id", payment.quotation_id)
          .maybeSingle();

        if (allPayments && quotation) {
          const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
          const totalAmount = parseFloat(quotation.total_amount);
          const isFullyPaid = Math.abs(totalPaid - totalAmount) < 0.01;

          await supabase
            .from("quotations")
            .update({
              status: isFullyPaid ? "approved" : "approved",
            })
            .eq("id", payment.quotation_id);

          const paymentMethodDisplay = paymentChannel || paymentMethod || "Xendit";
          const activityDescription = `Payment received ₱${parseFloat(payment.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })} via ${paymentMethodDisplay} (Ref: ${externalId || invoiceId})`;

          await supabase.from("activities").insert({
            company_id: payment.company_id,
            quotation_id: payment.quotation_id,
            activity_type: "payment",
            description: activityDescription,
            created_at: new Date().toISOString(),
          });
        }
      } else if (payment.proforma_invoice_id) {
        const { data: allPayments } = await supabase
          .from("payments")
          .select("amount")
          .eq("proforma_invoice_id", payment.proforma_invoice_id)
          .eq("payment_status", "paid")
          .neq("verification_status", "rejected");

        const { data: proformaInvoice } = await supabase
          .from("proforma_invoices")
          .select("total_amount")
          .eq("id", payment.proforma_invoice_id)
          .maybeSingle();

        if (allPayments && proformaInvoice) {
          const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
          const totalAmount = parseFloat(proformaInvoice.total_amount);
          const isFullyPaid = Math.abs(totalPaid - totalAmount) < 0.01;

          await supabase
            .from("proforma_invoices")
            .update({
              status: isFullyPaid ? "paid" : "finalized",
            })
            .eq("id", payment.proforma_invoice_id);

          console.log(`Proforma invoice ${payment.proforma_invoice_id} status updated. Fully paid: ${isFullyPaid}`);
        }
      }
    }

    console.log("Payment updated successfully:", payment.id, "Status:", paymentStatus);

    return new Response(
      JSON.stringify({ success: true, message: "Webhook processed" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});