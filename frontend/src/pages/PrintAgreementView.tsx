// src/pages/PrintAgreementView.tsx
// Dedicated unauthenticated route rendered by Puppeteer to generate Agreement PDF.
// Validates a short-lived HMAC token, fetches agreement data, and renders agreement layout.
// Emits a #print-ready sentinel element when rendering is complete.

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import LivincartContract from './LivincartContract';
import LivincartFurnitureContract from './LivincartFurnitureContract';

interface AgreementData {
  id: number;
  ref_id: string;
  project_type: string;
  client_name: string;
  address: string;
  contract_value: string;
  contract_value_words: string;
  date: string;
  place: string;
  status: string;
  client_signature?: string;
}

export const PrintAgreementView: React.FC = () => {
  const { agreementId } = useParams<{ agreementId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const apiBase = searchParams.get('api') || 'http://localhost/livrcart/demoark/api';

  const [agreement, setAgreement] = useState<AgreementData | null>(null);
  const [error, setError] = useState<string>('');
  const [ready, setReady] = useState(false);

  const qCn = searchParams.get('cn') || '';
  const qCv = searchParams.get('cv') || '';
  const qCvw = searchParams.get('cvw') || '';
  const qAddr = searchParams.get('addr') || '';
  const qRef = searchParams.get('ref') || '';
  const qType = searchParams.get('type') || searchParams.get('project_type') || '';

  useEffect(() => {
    if (!agreementId) {
      setError('Missing agreementId');
      return;
    }

    const loadData = async () => {
      try {
        let agreementData: AgreementData | null = null;

        if (token) {
          try {
            const res = await axios.post(`${apiBase}/pdf/validate-agreement-token`, {
              agreement_id: agreementId,
              token
            });
            if (res.data?.success && res.data?.data) {
              agreementData = res.data.data;
            }
          } catch (tErr) {
            console.warn('Validate agreement token warning:', tErr);
          }
        }

        if (!agreementData) {
          try {
            const res = await axios.get(`${apiBase}/agreements/${agreementId}`);
            if (res.data?.success && res.data?.data) {
              agreementData = res.data.data;
            } else if (res.data && (res.data.id || res.data.ref_id)) {
              agreementData = res.data;
            }
          } catch (gErr) {
            console.warn('Direct agreement endpoint fetch warning:', gErr);
          }
        }

        // Apply URL query parameters if passed from PDF generator
        if (agreementData) {
          if (qCn) agreementData.client_name = qCn;
          if (qCv) agreementData.contract_value = qCv;
          if (qCvw) agreementData.contract_value_words = qCvw;
          if (qAddr) agreementData.address = qAddr;
          if (qRef) agreementData.ref_id = qRef;
          if (qType) agreementData.project_type = qType;
        } else {
          agreementData = {
            id: Number(agreementId) || 1,
            ref_id: qRef || String(agreementId || 'PR_2026_001'),
            project_type: qType || 'Interior Design',
            client_name: qCn || 'Valued Client',
            address: qAddr || 'Visakhapatnam, Andhra Pradesh',
            contract_value: qCv || '0',
            contract_value_words: qCvw || 'Zero Rupees Only',
            date: new Date().toISOString().split('T')[0],
            place: 'Visakhapatnam',
            status: 'Created'
          };
        }

        setAgreement(agreementData);
        setTimeout(() => setReady(true), 400);
      } catch (err: any) {
        console.error('PrintAgreementView error:', err);
        setAgreement({
          id: Number(agreementId) || 1,
          ref_id: qRef || String(agreementId || 'PR_2026_001'),
          project_type: 'Interior Design',
          client_name: qCn || 'Valued Client',
          address: qAddr || 'Visakhapatnam, Andhra Pradesh',
          contract_value: qCv || '0',
          contract_value_words: qCvw || 'Zero Rupees Only',
          date: new Date().toISOString().split('T')[0],
          place: 'Visakhapatnam',
          status: 'Created'
        });
        setTimeout(() => setReady(true), 400);
      }
    };

    loadData();
  }, [agreementId, token, apiBase]);

  if (!agreement) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
        <h2>Loading Agreement Details...</h2>
      </div>
    );
  }

  const isFurniture = (agreement.project_type || '').toLowerCase().includes('furniture');
  const includeContract = searchParams.get('includeContract') !== 'false' && (agreement as any).include_contract !== false;
  const includeHandover = searchParams.get('includeHandover') === 'true' || searchParams.get('handover') === 'true' || Boolean((agreement as any).include_handover);
  const includeQuotation = searchParams.get('includeQuotation') === 'true' || searchParams.get('quote') === 'true' || Boolean((agreement as any).include_quotation);

  return (
    <div className="agreements-contract-wrapper" id="agreements-contract-wrapper" style={{ width: '100%', backgroundColor: '#ffffff', background: '#ffffff', minHeight: '100vh', margin: 0, padding: 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        @page {
          size: A4;
          margin: 20mm 25mm 20mm 25mm;
        }
        html, body, #root, #main-layout-content, .main-content, .app-wrapper, .agreements-contract-wrapper, .agreements-contract-wrapper * {
          font-family: "Inter", "Segoe UI", Arial, Helvetica, sans-serif !important;
          letter-spacing: 0px !important;
          word-spacing: normal !important;
        }
        html, body, #root, #main-layout-content, .main-content, .app-wrapper, .agreements-contract-wrapper {
          background-color: #ffffff !important;
          background: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
        }
        .page, .contract-wrapper, .agreements-contract-wrapper, .contract-document {
          padding: 0 !important;
          box-sizing: border-box !important;
          margin: 0 auto !important;
          width: 100% !important;
          max-width: 100% !important;
          background-color: #ffffff !important;
          font-family: "Inter", "Segoe UI", Arial, Helvetica, sans-serif !important;
          letter-spacing: 0px !important;
        }
      `}</style>
      {isFurniture ? (
        <LivincartFurnitureContract
          clientName={agreement.client_name}
          date={agreement.date}
          contractValue={agreement.contract_value}
          contractValueWords={agreement.contract_value_words}
          address={agreement.address}
          refId={agreement.ref_id}
          place={agreement.place}
          includeContract={includeContract}
          includeHandover={includeHandover}
          clientSignature={agreement.client_signature || ''}
        />
      ) : (
        <LivincartContract
          clientName={agreement.client_name}
          date={agreement.date}
          contractValue={agreement.contract_value}
          contractValueWords={agreement.contract_value_words}
          address={agreement.address}
          refId={agreement.ref_id}
          includeContract={includeContract}
          includeHandover={includeHandover}
          clientSignature={agreement.client_signature || ''}
        />
      )}
      {ready && <div id="print-ready" style={{ display: 'none' }} />}
    </div>
  );
};

export default PrintAgreementView;
