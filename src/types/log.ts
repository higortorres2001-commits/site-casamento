export interface Log {
  id: string;
  created_at: string;
  level: string;
  context: string;
  message: string;
  metadata: any;
}