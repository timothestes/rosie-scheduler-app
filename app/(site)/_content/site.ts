// Contact details, links and downloads shown on the public portfolio.

export const site = {
  name: 'Rosie Quintana',
  roles: ['Actor', 'Singer', 'Pianist'],
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
  // Scheduler pages. Plain <a> links, not next/link: on rosiequintana.com these
  // leave for the scheduler's own domain (see lib/site-routing.ts).
  bookingHref: '/schedule',
  loginHref: '/login',
} as const;
