import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { amount, currency, description, externalId, successRedirectUrl, failureRedirectUrl, apiKey } = await req.json();

    console.log("Creating Xendit invoice:", { externalId, amount, currency });

    if (!amount || !currency || !externalId || !apiKey) {
      console.error("Missing required fields:", { amount, currency, externalId, hasApiKey: !!apiKey });
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const amountInt = Math.round(parseFloat(amount));

    const invoicePayload = {
      external_id: externalId,
      amount: amountInt,
      currency: currency,
      description: description || "Payment",
      success_redirect_url: successRedirectUrl,
      failure_redirect_url: failureRedirectUrl,
    };

    console.log("Xendit request payload:", invoicePayload);

    const xenditResponse = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(apiKey + ":")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(invoicePayload),
    });

    const responseData = await xenditResponse.json();
    console.log("Xendit response:", { status: xenditResponse.status, data: responseData });

    if (!xenditResponse.ok) {
      console.error("Xendit API error:", responseData);
      const errorMessage = responseData.message || responseData.error_code || "Failed to create invoice";
      return new Response(
        JSON.stringify({ error: errorMessage, details: responseData }),
        {
          status: xenditResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Exception in xendit-create-invoice:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});