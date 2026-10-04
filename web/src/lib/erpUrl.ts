export function expertErpUrl(): string {
  return '/erp?set=expert'
}

export function learnerErpUrl(tutorSessionId?: string): string {
  return tutorSessionId ? `/erp?set=newhire&tutor=${tutorSessionId}` : '/erp?set=newhire'
}
