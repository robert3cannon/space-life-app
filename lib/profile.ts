export function displayName() {
  return process.env.USER_NAME?.trim() || "Robert";
}

export function greetingFor(hour: number, name: string) {
  if (hour < 12) return `Easy morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  if (hour < 22) return `Good evening, ${name}`;
  return `Night owl hours, ${name}`;
}
