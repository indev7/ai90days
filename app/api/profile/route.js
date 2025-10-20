import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserById, updateUser } from '@/lib/db';
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

    const { firstName, lastName, currentPassword, newPassword, preferredVoice } = await request.json();

    // Validate required fields
    if (!firstName || firstName.trim().length === 0) {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 }
      );
    }

    const userId = parseInt(session.sub);

    // Get current user for password verification
    const currentUser = await getUserById(userId);
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

    // Only update preferences if preferredVoice is provided
    if (preferredVoice) {
      // Parse existing preferences
      let preferences = { preferred_voice: 'alloy', theme: 'purple' };
      if (currentUser.preferences) {
        try {
          preferences = JSON.parse(currentUser.preferences);
        } catch (e) {
          console.error('Failed to parse preferences:', e);
        }
      }
      
      // Update preferred voice
      preferences.preferred_voice = preferredVoice;
      updateData.preferences = JSON.stringify(preferences);
    }

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
    const updatedUser = await updateUser(userId, updateData);

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.display_name,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        preferences: updatedUser.preferences,
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
