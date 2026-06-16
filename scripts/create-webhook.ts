/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios'
import { API_CONFIG } from '@/config'


async function createWebhook() {
  try {
    const res = await axios.post(
      `${ API_CONFIG.CLICKUP_API_BASE }/team/9017044866/webhook`,
      {
        endpoint: 'https://task-automation-zeta.vercel.app/api/clickup-webhook',
        events: ['taskCreated', 'taskUpdated', 'taskDeleted']
      },
      {
        headers: {
          Authorization: process.env.CLICKUP_API_TOKEN || '',
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Webhook creado correctamente:');
    console.log(JSON.stringify(res.data, null, 2));
    console.log(`👉 Guarda este valor como CLICKUP_WEBHOOK_SECRET: ${res.data.webhook.secret}`);
  } catch (error: any) {
    console.error('❌ Error al crear webhook:', error?.response?.data || error.message);
  }
}

createWebhook();
