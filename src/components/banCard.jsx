import { Link } from "react-router-dom";

export default function BanCard({ ban, guest, issuedBy, offenses }) {
  const guestName = guest
    ? [guest.first_name, guest.last_name].filter(Boolean).join(" ")
    : "Unknown Guest";

  const offenseNames = offenses
    ? offenses.filter(Boolean).map((o) => o?.name).join(", ")
    : "Unknown";

  const statusColor = ban.is_active
    ? "bg-red-900 text-red-300"
    : "bg-gray-700 text-gray-400";

  const statusLabel = ban.is_active ? "Active" : "Lifted / Expired";

  return (
    <div className="bg-gray-800 rounded-lg shadow p-4 flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <p className="font-semibold text-white text-lg">{guestName}</p>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {guest?.alias && (
        <p className="text-sm text-gray-400">aka {guest.alias}</p>
      )}

      <p className="text-sm text-gray-400">
        <span className="font-medium">Offenses:</span> {offenseNames}
      </p>

      <p className="text-sm text-gray-400">
        <span className="font-medium">Issued:</span> {ban.issued_date}
      </p>

      <p className="text-sm text-gray-400">
        <span className="font-medium">Expires:</span> {ban.expiry_date}
      </p>

      <p className="text-sm text-gray-400">
        <span className="font-medium">Issued by:</span>{" "}
        {issuedBy ? `${issuedBy.first_name} ${issuedBy.last_name}` : "Unknown"}
      </p>

      {ban.notes && (
        <p className="text-sm text-gray-500 italic">"{ban.notes}"</p>
      )}

      <Link
        to={`/guest/${guest?.id}`}
        className="text-blue-500 text-sm mt-1 hover:underline"
      >
        View guest profile →
      </Link>
    </div>
  );
}