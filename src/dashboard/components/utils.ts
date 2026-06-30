export function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'green';
    case 'expired':
      return 'yellow';
    case 'revoked':
      return 'red';
    default:
      return 'gray';
  }
}

export function getTimeUntilExpiry(dateString: string): string {
  const now = Date.now();
  const expiry = new Date(dateString).getTime();
  const diff = expiry - now;

  if (diff <= 0) {
    const elapsed = Math.abs(diff);
    const mins = Math.floor(elapsed / 60000);
    const hours = Math.floor(elapsed / 3600000);
    const days = Math.floor(elapsed / 86400000);
    if (days > 0) return `Dormant ${days}d ago`;
    if (hours > 0) return `Dormant ${hours}h ago`;
    return `Dormant ${mins}m ago`;
  }

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m remaining`;
  if (hours < 24) return `${hours}h remaining`;
  return `${days}d remaining`;
}
