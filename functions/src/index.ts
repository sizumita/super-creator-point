import * as functions from "firebase-functions";
import * as admin from "firebase-admin";


admin.initializeApp();

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });


const MENTORS = [
    "nishio",
    "taizan",
    "shoya140",
    "teramotodaiki",
    "yuukai",
    "yasulab",
    "kakeru",
];


async function log(data: any) {
    await admin.firestore().collection("logs").add(data);
}

async function getPoint(userName: string): Promise<number> {
    const document = await admin.firestore().collection("users").doc(userName).get();
    let point = 100;
    if (document.exists) {
        const data = document.data();
        point = data!.point;
    } else {
        await admin.firestore().collection("users").doc(userName).set({
            point,
        }, {merge: true});
    }
    return point;
}

async function showHelp(request: functions.Request, response: functions.Response) {
    const point = await getPoint(request.body.user_name as string);
    const text = "| コマンド名 | 引数     | 説明                                                                                               |\n" +
                 "|:---------|:---------|:--------------------------------------------------------------------------------------------------|\n" +
                 "| scp      | なし      | このメッセージを表示します。ついでに所持しているスパクリポイントを表示します。                                  |\n" +
                 "| scp give | メンション | スパクリポイントを贈与します。メンターは無尽蔵に発行できますが、他の方は所持しているスパクリポイントから消費されます。 |\n\n" +
    `あなたのスーパークリエーターポイント: ${point}ポイント`;
    response.send({text: text});
}


async function givePoint(fromUser: string, toUser: string, amount: number) {
    await admin.firestore().collection("users").doc(toUser).set({
        point: admin.firestore.FieldValue.increment(amount),
    }, {merge: true});
    await log({type: "increment_point", actor: fromUser, user: toUser, amount: amount});
}


async function givePointByMentor(fromUser: string, toUser: string, amount: number): Promise<string> {
    if (amount <= 0 || amount > 100) {
        return "1~100ポイントの間で指定してください。";
    }
    await givePoint(fromUser, toUser, amount);
    return `@${toUser} さんに ${amount}コインを贈与しました！`;
}


async function givePointByUser(fromUser: string, toUser: string, amount: number): Promise<string> {
    const point = await getPoint(fromUser);
    if (point < amount) {
        return `ポイントが足りません (${point} < ${amount})`;
    }
    if (amount <= 0 || amount > 100) {
        return "1~100ポイントの間で指定してください。";
    }
    await admin.firestore().collection("users").doc(fromUser).update({
        point: admin.firestore.FieldValue.increment(-amount),
    });
    await log({type: "decrement_point", actor: fromUser, user: fromUser, amount: amount});
    await givePoint(fromUser, toUser, amount);
    return `@${toUser} さんに ${amount}コインを贈与しました！`;
}


// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isMentor(userName: string): boolean {
    // 最初なのでこう
    return MENTORS.includes(userName);
}


function getUserName(raw: string) {
    if (raw.startsWith("@")) {
        return raw.slice(1);
    } else {
        return raw;
    }
}


async function processCommands(request: functions.Request, response: functions.Response) {
    const args = (request.body.text as string).split(" ");
    switch (args[1]) {
        case "give":
            if (isMentor(request.body.user_name)) {
                response.send({
                    text: await givePointByMentor(request.body.user_name, getUserName(args[2]), Number(args[3])),
                });
            } else {
                response.send({
                    text: await givePointByUser(request.body.user_name, getUserName(args[2]), Number(args[3])),
                });
            }
            break;
        default:
            response.send({
                text: "不正なコマンドです。",
            });
    }
}


export const matterMostWebhook = functions.https.onRequest(async (request, response) => {
    const args = (request.body.text as string).split(" ");
    try {
        switch (args.length) {
            case 1:
                await showHelp(request, response);
                break;
            default:
                await processCommands(request, response);
                break;
        }
    } catch (e) {
        console.log(e);
        response.send({
            text: "不正なコマンドです。",
        });
    }
});
