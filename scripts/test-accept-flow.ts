import dotenv from 'dotenv';
dotenv.config();

import { adminReviewManager } from '../server/adminReviewService.js';
import { gitLfsService } from '../server/gitLfsService.js';

async function testAcceptFlow() {
  console.log('=====================================================');
  console.log('TESTING ADMIN ACCEPT API & PERSISTENT STAGING FLOW');
  console.log('=====================================================\n');

  const samplePdfContent = Buffer.from(
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n` +
    `4 0 obj\n<< /Length 55 >>\nstream\nBT /F1 12 Tf 100 700 TD (Dafa Khojau Legal Test PDF) Tj ET\nendstream\nendobj\n` +
    `xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000214 00000 n\n` +
    `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n318\n%%EOF`
  );

  const testFolder = 'कानुन तथा निर्देशिका';
  const testFileName = `test_legal_document_${Date.now()}.pdf`;

  console.log(`1. Staging test PDF file "${testFileName}"...`);
  const stageRes = adminReviewManager.stageUpload(
    testFolder,
    testFileName,
    samplePdfContent,
    'Integration Tester',
    'परीक्षणका लागि अपलोड गरिएको कागजात'
  );

  if (!stageRes.success || !stageRes.pendingItem) {
    throw new Error(`Staging failed: ${stageRes.error}`);
  }
  console.log(' -> Staging Success! Pending ID:', stageRes.pendingItem.id);
  console.log(' -> Staging Path:', stageRes.pendingItem.stagingPath);

  console.log('\n2. Executing Admin Accept on Staged Item...');
  const acceptRes = await adminReviewManager.acceptUpload(
    stageRes.pendingItem.id,
    'Admin Test Officer',
    'परीक्षण स्वीकृत गरियो'
  );

  console.log(' -> Accept Result Success:', acceptRes.success);
  console.log(' -> Accept Result Message:', acceptRes.message);
  console.log(' -> GitHub Pushed:', acceptRes.item?.adminDecision?.githubPushed);
  console.log(' -> LFS Tracked:', acceptRes.item?.adminDecision?.isLfsTracked);

  if (!acceptRes.success) {
    throw new Error(`Accept failed: ${acceptRes.error}`);
  }

  console.log('\n=====================================================');
  console.log('ADMIN ACCEPT FLOW VERIFICATION PASSED!');
  console.log('=====================================================');
}

testAcceptFlow().catch(err => {
  console.error('Accept flow test failed:', err);
  process.exit(1);
});
