import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '10s',


  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export default function () {
  // Authenticate using your NestJS login endpoint.
  const loginResponse = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL,
      password: __ENV.TEST_PASSWORD,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  const loginSucceeded = check(loginResponse, {
    'login returns 200': (r) => r.status === 200,
    
  });
  
console.log(
  `Login response time: ${loginResponse.timings.duration.toFixed(2)} ms`,
);
  if (!loginSucceeded) {
    console.error(`Login failed: HTTP ${loginResponse.status}`);
    return;
  }

  let token;

  try {
    token = loginResponse.json('accessToken');
  } catch (_) {
    console.error('Could not parse the login response.');
    return;
  }

  if (!token) {
    console.error(
      'No accessToken found. Check your LoginResponseDto response shape.',
    );
    return;
  }

  // Request the protected events endpoint.
  const eventsResponse = http.get(`${BASE_URL}/events`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  console.log(
  `Events response time: ${eventsResponse.timings.duration.toFixed(2)} ms`,
);

  check(eventsResponse, {
    'events returns 200': (r) => r.status === 200,
  });

  sleep(1);
}