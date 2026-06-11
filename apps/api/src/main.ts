import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    rawBody: true, // needed to verify Razorpay webhook signatures over the raw body
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableCors({
    origin: buildCorsOrigin(),
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`RestroGenie API running on port ${port}`);
}

/**
 * CORS origin resolver.
 * - unset or "*"        → reflect any origin (dev convenience)
 * - comma-separated list → exact match, with wildcard subdomain support
 *   e.g. CORS_ORIGIN="https://*.yourpos.com,https://yourpos.com"
 */
function buildCorsOrigin(): any {
  const v = process.env.CORS_ORIGIN;
  if (!v || v === '*') return true;
  const patterns = v.split(',').map((s) => s.trim()).filter(Boolean);
  return (origin: string, cb: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return cb(null, true); // non-browser clients (curl, mobile)
    const ok = patterns.some((p) => {
      if (p.includes('*')) {
        const re = new RegExp('^' + p.replace(/[.]/g, '\\.').replace(/\*/g, '[^.]+') + '$');
        return re.test(origin);
      }
      return p === origin;
    });
    // deny by omitting the header (no 500) — the browser blocks it cleanly
    cb(null, ok);
  };
}

bootstrap();
