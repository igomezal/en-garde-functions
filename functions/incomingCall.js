const VoiceResponse = require('twilio').twiml.VoiceResponse;
const functions = require('firebase-functions');
const admin = require('firebase-admin');

module.exports = functions.https.onRequest(async (request, response) => {

    function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function generateRedirectionUrl(phones) {
        let url = 'https://twimlets.com/findme?Dial=true&FailUrl=https%3A%2F%2Fhandler.twilio.com%2Ftwiml%2FEH0af42e61e4f3157e5776a06066eb0627&Timeout=&Message=This+is+and+I-N-G+on+duty+call.+Press+any+key+to+accept+the+incoming+call';
        phones.forEach(phone => {url += `&PhoneNumbers%5B%5D=${encodeURIComponent(phone)}`});
        return url;
    }

    const twiml = new VoiceResponse();

    const db = admin.firestore();

    const currentDutyDay = new Date().toISOString().split('T')[0];


    const onDutyUsers = await Promise.resolve(db.doc(`dutyDays/${currentDutyDay}`).get());
    const onDutyUsersData = onDutyUsers.data();

    functions.logger.info(onDutyUsersData);

    let usersToBeNotifiedData;

    if(onDutyUsersData && onDutyUsersData.users && onDutyUsersData.users.length > 0) {
        usersToBeNotifiedData = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', onDutyUsersData.users).get();
    } else {
        // EMERGENCY: Nobody is on duty at this moment, all users get added. Sorry!
        usersToBeNotifiedData = await db.collection('users').get();
    }
    functions.logger.info(usersToBeNotifiedData);
    let phoneNumbersInPriorityOrder = usersToBeNotifiedData.docs.map(user => {
        const {telephone, availability = true} = user.data();
        return { telephone, availability };
    }).reduce(([available, notAvailable], user) => {
        return user.availability ? [[...available, user], notAvailable] : [available, [...notAvailable, user]];
    }, [[], []]).map(phonesToShuffle => shuffle(phonesToShuffle));

    phoneNumbersInPriorityOrder = [...phoneNumbersInPriorityOrder[0], ...phoneNumbersInPriorityOrder[1]].map(user => user.telephone).filter(phone => phone !== '');
    functions.logger.info(phoneNumbersInPriorityOrder);



    if (phoneNumbersInPriorityOrder.length > 0) {
        const firstPhone = phoneNumbersInPriorityOrder.shift();
        twiml.say("Welcome to Phoenix and Dragon on duty support phone. We will try to connect you to the main on call. If we are unable to reach him, we will then try to connect you to the backup on call automatically.");
        let options = {timeout: 30};
        if (phoneNumbersInPriorityOrder.length > 0) {
            options = {
                action: generateRedirectionUrl(phoneNumbersInPriorityOrder),
                timeout: 30
            };
        }
        twiml.dial(options).number({url: "https://twimlets.com/whisper?Message=This+is+and+I-N-G+on+duty+call.+Press+any+key+to+accept+the+incoming+call&HumanCheck=1"}, firstPhone);

    } else {
        // TODO: EMERGENCY!!!!!!!!!!
    }

    response.writeHead(200, { 'Content-Type': 'text/xml' });
    response.end(twiml.toString());

});