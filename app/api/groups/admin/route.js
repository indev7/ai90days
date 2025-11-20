import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserAdminGroups } from '@/lib/pgdb';

export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminGroups = await getUserAdminGroups(user.sub);
    return NextResponse.json({ groups: adminGroups });
  } catch (error) {
    console.error('Error fetching admin groups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}