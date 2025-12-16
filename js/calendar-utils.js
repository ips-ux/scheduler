/**
 * Calendar Utilities
 * Functions for generating iCalendar (.ics) files and sending calendar emails
 */

const CalendarUtils = {
    /**
     * Generate iCalendar (.ics) format string from reservation data
     * @param {Object} reservationData - Reservation details
     * @returns {string} iCalendar formatted string
     */
    generateICalendar: (reservationData) => {
        const {
            rented_to,
            item,
            items,
            resource_type,
            start_time,
            end_time,
            rental_notes,
            scheduled_by
        } = reservationData;

        // Format dates for iCalendar (YYYYMMDDTHHMMSS)
        const formatICalDate = (dateStr) => {
            const date = new Date(dateStr);
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const startDate = formatICalDate(start_time);
        const endDate = formatICalDate(end_time);
        const now = formatICalDate(new Date().toISOString());

        // Generate unique ID for the event
        const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@beacon85.greystar.com`;

        // Determine event title and description
        let title = '';
        let description = '';

        if (resource_type === 'GUEST_SUITE') {
            title = `Guest Suite - Unit ${rented_to}`;
            description = `Guest Suite reservation for Unit ${rented_to}`;
        } else if (resource_type === 'SKY_LOUNGE') {
            title = `Sky Lounge - Unit ${rented_to}`;
            description = `Sky Lounge reservation for Unit ${rented_to}`;
        } else if (resource_type === 'GEAR_SHED') {
            const itemsList = items || [item];
            title = `Gear Shed - Unit ${rented_to}`;
            description = `Gear Shed reservation for Unit ${rented_to}\\nItems: ${itemsList.join(', ')}`;
        }

        if (rental_notes) {
            description += `\\n\\nNotes: ${rental_notes}`;
        }

        if (scheduled_by) {
            description += `\\n\\nScheduled by: ${scheduled_by}`;
        }

        // Build iCalendar content
        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Beacon 85//Amenity Scheduler//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${now}`,
            `DTSTART:${startDate}`,
            `DTEND:${endDate}`,
            `SUMMARY:${title}`,
            `DESCRIPTION:${description}`,
            'LOCATION:Beacon 85',
            'STATUS:CONFIRMED',
            'SEQUENCE:0',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        return icsContent;
    },

    /**
     * Create and download iCalendar file
     * @param {Object} reservationData - Reservation details
     * @param {string} filename - Name for the .ics file
     */
    downloadICalendar: (reservationData, filename = 'reservation.ics') => {
        const icsContent = CalendarUtils.generateICalendar(reservationData);
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    },

    /**
     * Send calendar email via Gmail API with iCalendar attachment
     * Uses the logged-in Google account to send email automatically
     * 
     * @param {Object} reservationData - Reservation details
     * @param {string} recipientEmail - Email address to send to
     */
    sendCalendarEmail: async (reservationData, recipientEmail = 'beacon85@greystar.com') => {
        try {
            const {
                rented_to,
                item,
                items,
                resource_type,
                start_time,
                end_time,
                rental_notes
            } = reservationData;

            // Format dates for email body
            const formatEmailDate = (dateStr) => {
                const date = new Date(dateStr);
                return date.toLocaleString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            };

            // Determine subject and body
            let subject = '';
            let body = '';

            if (resource_type === 'GUEST_SUITE') {
                subject = `Calendar Invite: Guest Suite - Unit ${rented_to}`;
                body = `Please add this Guest Suite reservation to your calendar.\n\n`;
                body += `Unit: ${rented_to}\n`;
                body += `Start: ${formatEmailDate(start_time)}\n`;
                body += `End: ${formatEmailDate(end_time)}\n`;
            } else if (resource_type === 'SKY_LOUNGE') {
                subject = `Calendar Invite: Sky Lounge - Unit ${rented_to}`;
                body = `Please add this Sky Lounge reservation to your calendar.\n\n`;
                body += `Unit: ${rented_to}\n`;
                body += `Start: ${formatEmailDate(start_time)}\n`;
                body += `End: ${formatEmailDate(end_time)}\n`;
            } else if (resource_type === 'GEAR_SHED') {
                const itemsList = items || [item];
                subject = `Calendar Invite: Gear Shed - Unit ${rented_to}`;
                body = `Please add this Gear Shed reservation to your calendar.\n\n`;
                body += `Unit: ${rented_to}\n`;
                body += `Items: ${itemsList.join(', ')}\n`;
                body += `Start: ${formatEmailDate(start_time)}\n`;
                body += `End: ${formatEmailDate(end_time)}\n`;
            }

            if (rental_notes) {
                body += `\nNotes: ${rental_notes}\n`;
            }

            body += `\nAn iCalendar (.ics) file is attached. Open it to add this event to your Outlook calendar.`;

            // Generate iCalendar content
            const icsContent = CalendarUtils.generateICalendar(reservationData);

            // Get OAuth access token for Gmail API
            // Firebase ID tokens don't work with Gmail API - we need the OAuth access token
            let token;

            if (Auth.credential && Auth.credential.accessToken) {
                // Use stored OAuth access token from login
                token = Auth.credential.accessToken;
            } else {
                // Fallback: try to get a fresh token by re-authenticating
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.addScope('https://www.googleapis.com/auth/gmail.send');

                try {
                    const result = await firebase.auth().currentUser.reauthenticateWithPopup(provider);
                    token = result.credential.accessToken;
                    Auth.credential = result.credential; // Store for future use
                } catch (reauthError) {
                    throw new Error('Please log out and log back in to grant Gmail permissions');
                }
            }

            if (!token) {
                throw new Error('No access token available. Please log out and log back in.');
            }

            // Create email with attachment in RFC 2822 format
            const boundary = '----=_Part_' + Date.now();
            const filename = `beacon85-${resource_type.toLowerCase()}-${rented_to.replace(/\s+/g, '-')}.ics`;

            // Build multipart email
            const email = [
                `To: ${recipientEmail}`,
                `Subject: ${subject}`,
                'MIME-Version: 1.0',
                `Content-Type: multipart/mixed; boundary="${boundary}"`,
                '',
                `--${boundary}`,
                'Content-Type: text/plain; charset=UTF-8',
                'Content-Transfer-Encoding: 7bit',
                '',
                body,
                '',
                `--${boundary}`,
                'Content-Type: text/calendar; charset=UTF-8; name="' + filename + '"',
                'Content-Transfer-Encoding: base64',
                'Content-Disposition: attachment; filename="' + filename + '"',
                '',
                btoa(icsContent),
                '',
                `--${boundary}--`
            ].join('\r\n');

            // Encode email in base64url format
            const encodedEmail = btoa(email)
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            // Send via Gmail API
            const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    raw: encodedEmail
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to send email');
            }

            return { success: true };
        } catch (error) {
            console.error('Failed to send calendar email:', error);
            throw error;
        }
    }
};
