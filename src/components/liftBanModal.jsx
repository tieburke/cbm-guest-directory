import { useState } from "react";

export default function LiftBanModal({ ban, guest, onClose, onConfirm }) {
  const [liftNotes, setLiftNotes] = useState("");

  const guestName = [guest.firstName, guest.lastName].filter(Boolean).join(" ");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-md">

        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Lift Ban</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl transition">✕</button>
        </div>

        <div className="px-6 py-6 flex flex-col gap-5">

          {/* Warning */}
          <div className="bg-yellow-900 border border-yellow-700 rounded-lg px-4 py-3">
            <p className="text-yellow-300 text-sm font-medium">
              You are lifting the active ban for{" "}
              <span className="text-white">{guestName}</span>.
            </p>
            <p className="text-yellow-400 text-xs mt-1">
              This action will be recorded in the audit log.
            </p>
          </div>

          {/* Ban summary */}
          <div className="bg-gray-700 rounded-lg px-4 py-3 flex flex-col gap-1">
            <p className="text-xs text-gray-400">
              <span className="text-gray-300 font-medium">Issued:</span> {ban.issuedDate}
            </p>
            <p className="text-xs text-gray-400">
              <span className="text-gray-300 font-medium">Was set to expire:</span> {ban.expiryDate}
            </p>
          </div>

          {/* Lift notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reason for lifting <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Guest appealed, situation resolved..."
              value={liftNotes}
              onChange={(e) => setLiftNotes(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-gray-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-lg border border-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(liftNotes)}
              className="flex-1 py-3 rounded-lg bg-yellow-600 text-white text-sm font-medium hover:bg-yellow-700 transition"
            >
              Confirm Lift
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}