export function statusBadge(status) {
  switch (status) {
    case 'open':
      return 'bg-blue-600 text-white'; // strong blue
    case 'in_progress':
      return 'bg-orange-500 text-white'; // strong orange
    case 'closed':
      return 'bg-green-600 text-white'; // strong green
    case 'cancelled':
      return 'bg-red-600 text-white'; // strong red
    default:
      return 'bg-gray-500 text-white';
  }
}

export function priorityBadge(priority) {
  switch (priority) {
    case 'urgent':
      return 'bg-red-700 text-white'; // dark red
    case 'high':
      return 'bg-yellow-500 text-black'; // bright yellow (black text for contrast)
    case 'medium':
      return 'bg-pink-500 text-white'; // strong pink
    case 'low':
      return 'bg-green-400 text-black'; // light green but readable
    default:
      return 'bg-gray-400 text-black';
  }
}
