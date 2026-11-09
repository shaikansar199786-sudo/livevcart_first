# PDF Generator Service

This service uses Puppeteer (Chromium) to generate PDFs that match the browser's print output exactly.

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Navigate to the pdf-generator directory:
```bash
cd c:\xampp\htdocs\livrcart\demoark\pdf-generator
```

2. Install dependencies:
```bash
npm install
```

### Running the Service

Start the PDF generator service:
```bash
npm start
```

The service will run on `http://localhost:3001`

### Health Check

Check if the service is running:
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "PDF generator is running"
}
```

### API Endpoint

**POST /generate-pdf**

Generates a PDF from a given URL.

Request body:
```json
{
  "url": "http://localhost:5173/quotes/123?print=true",
  "quoteId": 123,
  "projectId": 456
}
```

Response:
```json
{
  "success": true,
  "pdf": "data:application/pdf;base64,......"
}
```

### Integration

The PHP API (`api/controllers/PdfController.php`) calls this service to generate PDFs for email attachments.

The frontend (`frontend/src/pages/QuotesPage.tsx`) calls the PHP endpoint which in turn calls this Node.js service.

### Troubleshooting

1. **Port 3001 already in use**: Change the PORT in `generate-pdf.js`
2. **Puppeteer fails to launch**: Ensure Chromium is installed (it downloads automatically)
3. **Timeout errors**: Increase the timeout in the PHP controller or the Node.js service
4. **CORS errors**: Ensure the frontend URL is accessible from the Node.js service

### Running as a Service (Windows)

To run this as a Windows service, use tools like:
- NSSM (Non-Sucking Service Manager)
- PM2 (Process Manager 2)

Example with PM2:
```bash
npm install -g pm2
pm2 start generate-pdf.js --name pdf-generator
pm2 save
pm2 startup
```
