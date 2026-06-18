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

  if (diff <= 0) return 'Expired';

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m remaining`;
  if (hours < 24) return `${hours}h remaining`;
  return `${days}d remaining`;
}
