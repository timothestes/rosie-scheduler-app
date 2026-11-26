// Contact details, links and downloads shown on the public pages.

export const site = {
  name: 'Rosie Quintana',
  roles: ['Actor', 'Singer', 'Pianist'],
  location: 'Santa Maria, CA',
  // The line a casting person looks for first; all four are on her resume.
  vitals: ['Mezzo with high belt, D3 to A5', '5\'8"', 'BMus vocal performance', 'PCPA acting certificate'],
  email: 'roselq42@gmail.com',
  phone: { display: '951-663-1304', href: 'tel:+19516631304' },
  social: [
    { label: 'Instagram', href: 'https://www.instagram.com/rosie.quintana.42/' },
    { label: 'Facebook', href: 'https://www.facebook.com/rosie.quintana.42/' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/rosie-quintana-rqd2/' },
  ],
  files: {
    resume: '/site/files/rosie-quintana-resume.pdf',
    headshots: '/site/files/rosie-quintana-headshots.zip',
    monthlyAgreement: '/site/files/monthly-lesson-agreement.pdf',
    individualAgreement: '/site/files/individual-lesson-agreement.pdf',
  },
  // The lessons page and the scheduler. Plain <a> links, not next/link: on
  // rosiequintana.com these leave for the lessons domain (see lib/site-routing.ts).
  lessonsHref: '/coaching',
  bookingHref: '/schedule',
  loginHref: '/login',
} as const;
