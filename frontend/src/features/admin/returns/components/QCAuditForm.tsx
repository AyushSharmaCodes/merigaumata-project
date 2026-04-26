import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  RotateCcw, 
  Truck, 
  ChevronRight,
  Flag,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { 
  QC_REASONS, 
  QC_SEVERITY, 
  QC_OUTCOME_ACTIONS, 
  QC_INVENTORY_ROUTING,
  type QCReason,
  type QCOutcomeAction,
  type QCInventoryRoute
} from '@/features/returns';

interface QCAuditFormProps {
  orderId: string;
  returnId: string;
  returnItemId: string;
  productPrice: number;
  quantity: number;
  onAuditComplete: (auditData: any) => Promise<void>;
  onCancel: () => void;
}

const QCAuditForm: React.FC<QCAuditFormProps> = ({
  orderId,
  returnId,
  returnItemId,
  productPrice,
  quantity,
  onAuditComplete,
  onCancel
}) => {
  const [status, setStatus] = useState<'passed' | 'failed'>('passed');
  const [reasonCode, setReasonCode] = useState<QCReason>(QC_REASONS.CUSTOMER_DAMAGE);
  const [severity, setSeverity] = useState<number>(0);
  const [deductionAmount, setDeductionAmount] = useState<number>(0);
  const [reverseLogisticsCost, setReverseLogisticsCost] = useState<number>(0);
  const [inventoryAction, setInventoryAction] = useState<QCInventoryRoute>(QC_INVENTORY_ROUTING.SELLABLE);
  const [actionTaken, setActionTaken] = useState<QCOutcomeAction>(QC_OUTCOME_ACTIONS.FULL_REFUND);
  const [isFraudFlagged, setIsFraudFlagged] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isFailed = status === 'failed';

  // Auto-calculate deduction based on status and severity
  useEffect(() => {
    if (status === 'passed') {
      setSeverity(0);
      setDeductionAmount(0);
      setInventoryAction(QC_INVENTORY_ROUTING.SELLABLE);
      setActionTaken(QC_OUTCOME_ACTIONS.FULL_REFUND);
    } else {
      // Failed default: 50% deduction, Non-resellable
      if (severity === 0) setSeverity(QC_SEVERITY.MEDIUM);
      if (inventoryAction === QC_INVENTORY_ROUTING.SELLABLE) setInventoryAction(QC_INVENTORY_ROUTING.DAMAGED);
      if (actionTaken === QC_OUTCOME_ACTIONS.FULL_REFUND) setActionTaken(QC_OUTCOME_ACTIONS.PARTIAL_REFUND);
    }
  }, [status]);

  useEffect(() => {
    const calculated = (severity / 100) * productPrice * quantity;
    setDeductionAmount(calculated);
  }, [severity, productPrice, quantity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onAuditComplete({
        status,
        reason_code: status === 'failed' ? reasonCode : null,
        severity,
        deduction_amount: deductionAmount,
        reverse_logistics_cost: reverseLogisticsCost,
        action_taken: actionTaken,
        inventory_action: inventoryAction,
        is_fraud_flagged: isFraudFlagged,
        notes
      });
    } catch (error) {
      console.error('Audit submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl p-8 shadow-2xl shadow-slate-200/50">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Quality Audit</h2>
          <p className="text-slate-500 text-sm mt-1">Item Physical Verification & Outcome Selection</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
          <button 
            onClick={() => setStatus('passed')}
            className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
              status === 'passed' 
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' 
                : 'text-slate-600 hover:bg-white'
            }`}
          >
            <CheckCircle2 size={18} /> Passed
          </button>
          <button 
            onClick={() => setStatus('failed')}
            className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
              status === 'failed' 
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                : 'text-slate-600 hover:bg-white'
            }`}
          >
            <XCircle size={18} /> Failed
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div
          className={`overflow-hidden transition-all duration-300 ${isFailed ? 'max-h-[900px] opacity-100 mb-0' : 'max-h-0 opacity-0 pointer-events-none'}`}
        >
          {isFailed && (
            <div className="space-y-8 pb-1">
              {/* Classification Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.values(QC_REASONS).map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setReasonCode(reason as QCReason)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all duration-300 relative overflow-hidden group ${
                      reasonCode === reason 
                        ? 'border-indigo-500 bg-indigo-50/50' 
                        : 'border-slate-100 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span className={`text-xs font-bold uppercase tracking-widest ${
                      reasonCode === reason ? 'text-indigo-600' : 'text-slate-400'
                    }`}>
                      {reason.replace(/_/g, ' ')}
                    </span>
                    {reasonCode === reason && (
                      <div className="absolute bottom-1 right-2 text-indigo-500">
                        <ShieldCheck size={20} />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Severity & Deduction */}
              <div className="bg-slate-50 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-semibold text-slate-700">Audit Severity Check</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    severity > 75 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {severity}% Damage
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={severity}
                  onChange={(e) => setSeverity(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex justify-between mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                  <span>Pristine</span>
                  <span>Minor</span>
                  <span>Wear</span>
                  <span>Damage</span>
                  <span>Total Loss</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global Stats View */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* Logistics Cost */}
           <div className="border border-slate-100 rounded-2xl p-5 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Truck size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Reverse Logistics</h4>
                  <p className="text-[10px] text-slate-500">Pick-up & Processing costs</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-semibold text-slate-400">Rs.</span>
                <input 
                  type="number" 
                  value={reverseLogisticsCost}
                  onChange={(e) => setReverseLogisticsCost(parseFloat(e.target.value))}
                  className="text-xl font-bold text-slate-900 bg-transparent border-none p-0 focus:ring-0 w-24"
                />
              </div>
           </div>

           {/* Deduction View */}
           <div className="border border-slate-100 rounded-2xl p-5 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">QC Deduction</h4>
                  <p className="text-[10px] text-slate-500">Loss due to item condition</p>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-semibold text-slate-400">Rs.</span>
                <span className="text-xl font-bold text-rose-600">{deductionAmount.toFixed(2)}</span>
              </div>
           </div>
        </div>

        {/* Outcome Path selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <RotateCcw size={14} /> Inventory Routing
              </label>
              <select 
                value={inventoryAction}
                onChange={(e) => setInventoryAction(e.target.value as QCInventoryRoute)}
                className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
              >
                {Object.values(QC_INVENTORY_ROUTING).map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
           </div>

           <div className="space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <RotateCcw size={14} /> Final Payout Action
              </label>
              <select 
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value as QCOutcomeAction)}
                className="w-full bg-slate-50 border-none rounded-xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
              >
                {Object.values(QC_OUTCOME_ACTIONS).map(opt => (
                  <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
                ))}
              </select>
           </div>
        </div>

        {/* Fraud Flagging Section */}
        <div className={`p-5 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between ${
            isFraudFlagged 
              ? 'border-rose-500 bg-rose-50/50' 
              : reasonCode === QC_REASONS.WRONG_ITEM_RETURNED 
                ? 'border-rose-200 bg-rose-25' 
                : 'border-slate-100 hover:border-slate-200'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-xl ${isFraudFlagged ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <Flag size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Fraud Flag</h4>
              <p className="text-[10px] text-slate-500">Enable deep-audit for this customer's next return</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={() => setIsFraudFlagged(!isFraudFlagged)}
            className={`w-12 h-6 rounded-full relative transition-all duration-300 ${isFraudFlagged ? 'bg-rose-500' : 'bg-slate-200'}`}
          >
            <div
              className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300"
              style={{ transform: `translateX(${isFraudFlagged ? 26 : 2}px)` }}
            />
          </button>
        </div>

        <div className="space-y-4">
           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle size={14} /> Auditor's Internal Notes
           </label>
           <textarea 
             rows={3}
             value={notes}
             onChange={(e) => setNotes(e.target.value)}
             placeholder="e.g. Scuffed heels, missing original brand tag..."
             className="w-full bg-slate-50 border-none rounded-2xl py-4 px-5 text-sm focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-300"
           />
        </div>

        <div className="flex gap-4 pt-4">
          <button 
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel Audit
          </button>
          <button 
            type="submit"
            disabled={isSubmitting}
            className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            {isSubmitting ? 'Syncing Audit...' : 'Finalize QC & Initiate Outcome'}
            <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default QCAuditForm;
