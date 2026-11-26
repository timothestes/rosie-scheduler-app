// Recent roles shown as the table on the Home page's first screen.
// Keep this to about six rows; the full list is on the resume.

export interface Credit {
  role: string;
  production: string;
  company: string;
}

export const recentCredits: Credit[] = [
  { role: 'Esmeralda', production: 'The Hunchback of Notre Dame', company: 'The Western Stage' },
  { role: 'Margo', production: 'Bright Star', company: 'Landmark Theatre Company' },
  { role: 'Meg Boyd', production: 'Damn Yankees', company: 'The Gem Theatre' },
  { role: 'Lady Katherine', production: 'Emilia', company: 'The Western Stage' },
  { role: 'Bailey Gallagher', production: 'John Proctor is the Villain', company: 'PCPA' },
  { role: 'Duke of Gloucester', production: 'Henry V', company: 'PCPA' },
];
