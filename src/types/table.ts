export interface TableDTO {
  readonly id: string;
  readonly label: string;
  readonly seats: number | null;
  readonly section: string | null;
  readonly isActive: boolean;
}
