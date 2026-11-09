const fs = require('fs');

const pinSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#ffffff"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';
const userSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#ea580c"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

const pinB64 = Buffer.from(pinSvg).toString('base64');
const userB64 = Buffer.from(userSvg).toString('base64');

['src/components/QuoteTab.tsx', 'src/pages/PrintQuoteView.tsx'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Replace line containing M12 2C8.13
  content = content.replace(
    /src="data:image\/svg\+xml;base64,[^"]*?M12 2C8\.13[^"]*?"/g,
    `src="data:image/svg+xml;base64,${pinB64}"`
  );

  // Replace line containing M12 12c2.21
  content = content.replace(
    /src="data:image\/svg\+xml;base64,[^"]*?M12 12c2\.21[^"]*?"/g,
    `src="data:image/svg+xml;base64,${userB64}"`
  );

  fs.writeFileSync(file, content, 'utf8');
  console.log('Cleaned', file);
});
