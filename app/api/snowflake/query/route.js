import { NextResponse } from 'next/server';
import { runSnowflakeQuery } from '@/lib/snowflakeQuery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const coerceSql = async (request) => {
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    return typeof body?.sql === 'string' ? body.sql : '';
  }

  const { searchParams } = new URL(request.url);
  return searchParams.get('sql') || '';
};

export async function POST(request) {
  try {
    const sql = (await coerceSql(request)).trim();
    if (!sql) {
      return NextResponse.json({ error: 'Missing sql in request body.' }, { status: 400 });
    }

    if (!/^select\b/i.test(sql)) {
      return NextResponse.json({ error: 'Only SELECT statements are allowed.' }, { status: 400 });
    }

    const result = await runSnowflakeQuery(sql);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    const status = error?.status || 500;
    return NextResponse.json(
      {
        error: error?.message || 'Snowflake query failed.'
      },
      { status }
    );
  }
}

export async function GET(request) {
  return POST(request);
}
