const functions = require('firebase-functions');
const admin = require('firebase-admin');

module.exports = functions.https.onCall(async (data, context) => {
    functions.logger.info('notifyAvailabilityChanged called');
    if (!context.auth) return { status: 'error', code: 401, message: 'Not signed in' };

    functions.logger.info('notifyAvailabilityChanged called');

    const currentDutyDay = new Date().toISOString().split('T')[0];

    try {
        const [ user, onDutyUsers ] = await Promise.all([admin.auth().getUser(context.auth.uid), admin.firestore().doc(`dutyDays/${currentDutyDay}`).get()]);
        const onDutyUsersData = onDutyUsers.data();
        if(onDutyUsersData && onDutyUsersData.users && onDutyUsersData.users.length > 0) {
            const usersToBeNotified = onDutyUsers.data().users.filter(userUid => userUid !== user.uid);
            const usersToBeNotifiedData = await admin.firestore().collection('users').where(admin.firestore.FieldPath.documentId(), 'in', usersToBeNotified).get();
            const usersToBeNotifiedToken = usersToBeNotifiedData.docs.map(user => user.data().notificationToken).filter((token) => token !== undefined && token !== '');

            const message = {
                data: {
                    timestamp: Date.now().toString(),
                },
                notification: {
                    title: `${user.displayName} ${data.available ? 'is' : 'is not'} available`,
                    body: `${user.displayName} who is with you in the on-duty call ${data.available ? 'is' : 'is not'} available ${data.available ? 'again' : 'now'}`,
                },
                tokens: usersToBeNotifiedToken,
                webpush: {
                    fcmOptions: {
                        link: 'https://en-garde-1b8c5.web.app/#/notifications',
                    },
                }
            };

            try {
                await admin.messaging().sendMulticast(message);
                functions.logger.info('notifyAvailabilityChanged notification sent');
            } catch(error) {
                functions.logger.error('notifyAvailabilityChanged notification not sent', error);
                return { status: 'error', code: 500, message: 'The was an error with the notification' };
            }
        }
    } catch(error) {
        functions.logger.error('notifyAvailabilityChanged notification not sent', error);
        return { status: 'error', code: 500, message: 'There was an error getting the notification'};
    }

    return { status: 'success', code: 201, message: 'The notification was sent' };
});