import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '15s',

  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export default function () {
  const token = __ENV.TEST_ACCESS_TOKEN;

  if (!token) {
    throw new Error(
      'TEST_ACCESS_TOKEN is missing. Set it in PowerShell before running k6.',
    );
  }

  const response = http.get(`${BASE_URL}/events`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  check(response, {
    'events returns 200': (r) => r.status === 200,
  });

  sleep(1);
}