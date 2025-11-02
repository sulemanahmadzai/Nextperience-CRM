import { useState, useRef, useEffect } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { Quotation } from '../../lib/database.types';

interface SignatureModalProps {
  quotation: Quotation;
  onClose: () => void;
}

export default function SignatureModal({ quotation, onClose }: SignatureModalProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signedBy, setSignedBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedBy.trim()) {
      setMessage({ type: 'error', text: 'Please enter your name' });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let hasSignature = false;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        hasSignature = true;
        break;
      }
    }

    if (!hasSignature) {
      setMessage({ type: 'error', text: 'Please provide a signature' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const signatureImage = canvas.toDataURL('image/png');

      const { error: updateError } = await supabase
        .from('quotations')
        .update({
          status: 'signed',
          signed_by: signedBy,
          signed_at: new Date().toISOString(),
          signature_image: signatureImage,
          notes: remarks ? `${quotation.notes || ''}\n\nAcceptance remarks: ${remarks}` : quotation.notes,
        })
        .eq('id', quotation.id);

      if (updateError) throw updateError;

      if (quotation.lead_id) {
        const { data: confirmedStage } = await supabase
          .from('pipeline_stages')
          .select('id')
          .eq('company_id', currentCompany?.id)
          .eq('name', 'Confirmed')
          .maybeSingle();

        if (confirmedStage) {
          await supabase
            .from('leads')
            .update({
              stage_id: confirmedStage.id,
            })
            .eq('id', quotation.lead_id);
        }
      }

      if (currentCompany && user) {
        await supabase.from('audit_logs').insert({
          company_id: currentCompany.id,
          user_id: user.id,
          action: 'accept',
          entity_type: 'quotation',
          entity_id: quotation.id,
          changed_fields: { signed_by: signedBy, signed_at: new Date().toISOString() },
        });
      }

      setMessage({ type: 'success', text: 'Quotation accepted successfully!' });
      setTimeout(() => onClose(), 1500);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to accept quotation' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Accept & Sign Quotation</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {message && (
            <div
              className={`mb-4 p-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={signedBy}
              onChange={(e) => setSignedBy(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">
                Signature <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={clearSignature}
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
            </div>
            <div className="border-2 border-slate-300 rounded-lg bg-white">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Draw your signature above</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Remarks (Optional)
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Add any remarks or acceptance notes..."
            />
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">By signing, you agree to:</h3>
            <ul className="text-xs text-slate-700 space-y-1">
              <li>• Accept the terms and conditions of this quotation</li>
              <li>• Confirm the pricing and specifications as stated</li>
              <li>• Proceed with the event booking as per the agreed terms</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Processing...' : 'Accept & Sign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
