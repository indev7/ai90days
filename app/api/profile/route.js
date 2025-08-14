import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { verifyPassword, hashPassword, validatePassword } from '@/lib/auth';

export async function PUT(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { firstName, lastName, currentPassword, newPassword } = await request.json();

    // Validate required fields
    if (!firstName || firstName.trim().length === 0) {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 }
      );
    }

    const database = await getDatabase();
    const userId = parseInt(session.sub);

    // Get current user for password verification
    const currentUser = await database.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    let updateData = {
      display_name: `${firstName.trim()} ${lastName?.trim() || ''}`.trim(),
      first_name: firstName.trim(),
      last_name: lastName?.trim() || '',
      updated_at: new Date().toISOString(),
    };

    // Handle password change if provided
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to change password' },
          { status: 400 }
        );
      }

      // Verify current password
      const isCurrentPasswordValid = await verifyPassword(currentPassword, currentUser.password_hash);
      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }

      // Validate new password
      const passwordError = validatePassword(newPassword);
      if (passwordError) {
        return NextResponse.json(
          { error: passwordError },
          { status: 400 }
        );
      }

      // Hash new password
      updateData.password_hash = await hashPassword(newPassword);
    }

    // Update user in database
    const updateFields = Object.keys(updateData);
    const updateValues = Object.values(updateData);
    const setClause = updateFields.map(field => `${field} = ?`).join(', ');

    await database.run(
      `UPDATE users SET ${setClause} WHERE id = ?`,
      [...updateValues, userId]
    );

    // Get updated user
    const updatedUser = await database.get('SELECT * FROM users WHERE id = ?', [userId]);

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.display_name,
        email: updatedUser.email,
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
