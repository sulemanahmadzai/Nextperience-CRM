import { useState, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { useGoogleAuth } from "../../contexts/GoogleAuthContext";
import { supabase } from "../../lib/supabase";
import { useCompany } from "../../contexts/CompanyContext";
import { useAuth } from "../../contexts/AuthContext";

interface EmailComposerModalProps {
  quotationId: string;
  customerEmail: string;
  customerName: string;
  quotationNumber: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EmailComposerModal({
  quotationId,
  customerEmail,
  customerName,
  quotationNumber,
  onClose,
  onSuccess,
}: EmailComposerModalProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { isConnected, sendEmail } = useGoogleAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [publicLink, setPublicLink] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    generateOrGetPublicLink();
    loadUserName();
  }, []);

  const loadUserName = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (data && typeof data === "object" && "full_name" in data) {
        setUserName(String((data as any).full_name || ""));
      }
    } catch (error) {
      console.error("Error loading user name:", error);
    }
  };

  const generateOrGetPublicLink = async () => {
    if (!user) return;
    setGeneratingLink(true);
    try {
      // Check if a public link already exists
      const { data: existingLink } = await supabase
        .from("quotation_public_links")
        .select("token")
        .eq("quotation_id", quotationId)
        .eq("is_active", true)
        .gte("expires_at", new Date().toISOString())
        .maybeSingle();

      let token: string;

      if (
        existingLink &&
        typeof existingLink === "object" &&
        "token" in existingLink
      ) {
        token = String((existingLink as any).token || "");
      } else {
        // Create a new public link
        const { data: newLink, error } = await supabase
          .from("quotation_public_links")
          .insert({
            quotation_id: quotationId,
            created_by: user.id,
          } as any)
          .select("token")
          .single();

        if (error) throw error;
        token = (newLink as any)?.token || "";
      }

      const link = `${window.location.origin}?q=${token}`;
      setPublicLink(link);

      // Update email body with the link
      const displayName = customerName.split(" ")[0] || customerName;
      const senderName = userName || user?.email?.split("@")[0] || "Your Team";
      const companyName = currentCompany?.name || "Our Company";

      const emailBody = `Hi ${displayName},

Thanks for your interest!

Please find attached your Quotation ${quotationNumber} for review.

When you're ready, you can easily sign and make your down payment through this link:

${link}

If you'd like any revisions or have questions, just reply to this email — happy to assist!

Warmly,
${senderName}
${companyName}`;

      setFormData({
        to: customerEmail,
        subject: `Your Quotation ${quotationNumber} is Ready!`,
        body: emailBody,
      });
    } catch (error: any) {
      console.error("Error generating public link:", error);
      setMessage({
        type: "error",
        text: "Failed to generate public link: " + error.message,
      });
    } finally {
      setGeneratingLink(false);
    }
  };

  const [formData, setFormData] = useState({
    to: customerEmail,
    subject: `Your Quotation ${quotationNumber} is Ready!`,
    body: `Hi ${customerName.split(" ")[0] || customerName},

Thanks for your interest!

Please find attached your Quotation ${quotationNumber} for review.

When you're ready, you can easily sign and make your down payment through this link:

[Link will be generated automatically]

If you'd like any revisions or have questions, just reply to this email — happy to assist!

Warmly,
${user?.email?.split("@")[0] || "Your Team"}
${currentCompany?.name || "Our Company"}`,
  });

  const openGoogleConnect = () => {
    const url = `${
      import.meta.env.VITE_SUPABASE_URL
    }/functions/v1/google-oauth-start`;
    window.open(
      url,
      "google-oauth",
      "width=520,height=640,menubar=no,toolbar=no,location=no,status=no"
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const pdfBase64 = await generateQuotationPDF();

      // Send email with HTML body including link
      const htmlBody = formData.body
        .replace(/\n/g, "<br>")
        .replace(
          publicLink,
          `<a href="${publicLink}" style="color: #059669; text-decoration: underline;">View and complete your quotation here</a>`
        );

      const emailResponse = await sendEmail({
        to: [formData.to],
        subject: formData.subject,
        body: htmlBody,
        attachments: [
          {
            filename: `Quotation_${quotationNumber}.pdf`,
            content: pdfBase64,
            mimeType: "application/pdf",
          },
        ],
      });

      // Store email message with Gmail message ID if available
      await supabase.from("email_messages").insert({
        company_id: currentCompany?.id || "",
        sender_id: user?.id || null,
        quotation_id: quotationId,
        direction: "outbound",
        from_address: user?.email || "",
        to_addresses: [formData.to],
        subject: formData.subject,
        body: formData.body,
        entity_type: "quotation",
        entity_id: quotationId,
        gmail_message_id: (emailResponse as any)?.id || null,
        status: "sent",
        sent_at: new Date().toISOString(),
        recipient_email: formData.to,
      } as any);

      await supabase
        .from("quotations")
        .update({ status: "sent" } as any)
        .eq("id", quotationId);

      if (currentCompany && user) {
        await supabase.from("audit_logs").insert({
          company_id: currentCompany.id,
          user_id: user.id,
          action: "send",
          entity_type: "quotation",
          entity_id: quotationId,
        } as any);
      }

      setMessage({ type: "success", text: "Quotation sent successfully!" });
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error("Error sending email:", error);
      setMessage({
        type: "error",
        text: error.message || "Failed to send quotation",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateQuotationPDF = async (): Promise<string> => {
    const { data: quotation } = await supabase
      .from("quotations")
      .select("*, quotation_lines(*), customers(*)")
      .eq("id", quotationId)
      .single();

    if (!quotation) throw new Error("Quotation not found");
    const q = quotation as any;

    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 1100;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create canvas context");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("QUOTATION", 50, 60);

    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(`#${quotationNumber}`, 50, 90);

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("FROM:", 50, 140);
    ctx.font = "14px sans-serif";
    ctx.fillText(currentCompany?.name || "Company Name", 50, 165);

    ctx.font = "bold 14px sans-serif";
    ctx.fillText("TO:", 50, 210);
    ctx.font = "14px sans-serif";
    ctx.fillText(customerName, 50, 235);
    ctx.fillText(customerEmail, 50, 255);

    ctx.font = "bold 14px sans-serif";
    ctx.fillText("Date:", 450, 140);
    ctx.font = "14px sans-serif";
    ctx.fillText(
      new Date(q.quotation_date || new Date()).toLocaleDateString(),
      520,
      140
    );

    let yPos = 320;
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(50, yPos, 700, 30);
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("Description", 60, yPos + 20);
    ctx.fillText("Qty", 400, yPos + 20);
    ctx.fillText("Unit Price", 500, yPos + 20);
    ctx.fillText("Amount", 650, yPos + 20);

    yPos += 40;
    ctx.font = "12px sans-serif";
    const lines = (q.quotation_lines || []) as any[];
    for (const line of lines) {
      ctx.fillText(line.description || "", 60, yPos);
      ctx.fillText(String(line.quantity || 0), 400, yPos);
      ctx.fillText(`₱${(line.unit_price || 0).toFixed(2)}`, 500, yPos);
      ctx.fillText(`₱${(line.subtotal || 0).toFixed(2)}`, 650, yPos);
      yPos += 25;
    }

    yPos += 20;
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(50, yPos);
    ctx.lineTo(750, yPos);
    ctx.stroke();

    yPos += 30;
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("Subtotal:", 550, yPos);
    ctx.fillText(`₱${(q.subtotal || 0).toFixed(2)}`, 650, yPos);

    yPos += 30;
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("Total:", 550, yPos);
    ctx.fillText(`₱${(q.total_amount || 0).toFixed(2)}`, 650, yPos);

    if (q.notes) {
      yPos += 50;
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("Notes:", 50, yPos);
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#64748b";
      const noteLines = String(q.notes).split("\n");
      noteLines.forEach((line: string, index: number) => {
        ctx.fillText(line, 50, yPos + 20 + index * 18);
      });
    }

    const dataUrl = canvas.toDataURL("image/png");
    return dataUrl.split(",")[1];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            Send Quotation
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {message && (
            <div
              className={`mb-4 p-3 rounded-lg ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {message.text}
            </div>
          )}

          {generatingLink && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating public link...
              </p>
            </div>
          )}

          {!isConnected && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 mb-2">
                Connect your Google account to send quotations via Gmail
              </p>
              <button
                type="button"
                onClick={openGoogleConnect}
                className="text-sm font-medium text-blue-700 hover:text-blue-900"
              >
                Connect with Google →
              </button>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              To
            </label>
            <input
              type="email"
              value={formData.to}
              onChange={(e) => setFormData({ ...formData, to: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Message
            </label>
            <textarea
              value={formData.body}
              onChange={(e) =>
                setFormData({ ...formData, body: e.target.value })
              }
              rows={10}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              required
            />
            {publicLink && (
              <p className="mt-2 text-xs text-slate-500">
                Public link:{" "}
                <span className="font-mono text-blue-600">{publicLink}</span>
              </p>
            )}
          </div>

          <div className="bg-slate-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-slate-600">
              The quotation PDF will be automatically attached to this email.
              {publicLink &&
                " The public link has been included in the message above."}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <span className="text-sm text-emerald-700 font-medium">
                  Connected to Google ✓
                </span>
              ) : (
                <span className="text-sm text-slate-500">Not connected</span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !isConnected}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Quotation
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
