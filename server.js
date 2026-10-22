const express = require("express");
const path = require("path");
const crypto = require("crypto");
const dns = require("dns");
const { MongoClient, ObjectId } = require("mongodb");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const app = express();

const PORT = 3000;

 const MONGODB_URL = "mongodb://127.0.0.1:27017";

 const DATABASE_NAME =
    "PaperForge";

const COLLECTION_NAME =
    "questions";

const PAPERS_COLLECTION =
    "papers";

const SETTINGS_COLLECTION =
    "system_settings";


/*
=========================================================
EXPRESS SETTINGS
=========================================================
*/

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/*
=========================================================
SIMPLE SECURITY
=========================================================

Password:
    Default = 1234

Recovery PIN:
    DHULAN KI VIDAI KA WAQT HONE BALA HAI

No:
    OTP
    WebAuthn
    Face Lock
    Random Recovery Code
    Recovery Code Regeneration
=========================================================
*/

const FIXED_RECOVERY_PIN =
    "DHULAN KI VIDAI KA WAQT HONE BALA HAI";


/*
=========================================================
ACTIVE LOGIN SESSIONS
=========================================================
*/

const activeSessions =
    new Map();


/*
=========================================================
HASH FUNCTION
=========================================================
*/

function hashValue(value) {

    const salt =
        crypto.randomBytes(32)
            .toString("hex");

    const hash =
        crypto.pbkdf2Sync(
            String(value),
            salt,
            100000,
            64,
            "sha512"
        ).toString("hex");

    return {
        hash: hash,
        salt: salt
    };
}


/*
=========================================================
VERIFY HASH
=========================================================
*/

function verifyHash(
    value,
    storedHash,
    storedSalt
) {

    if (
        !storedHash ||
        !storedSalt
    ) {
        return false;
    }

    const hash =
        crypto.pbkdf2Sync(
            String(value),
            storedSalt,
            100000,
            64,
            "sha512"
        ).toString("hex");

    return (
        hash === storedHash
    );
}


/*
=========================================================
CREATE SESSION
=========================================================
*/

function createSession(
    role = "admin"
) {

    const sessionToken =
        crypto.randomBytes(32)
            .toString("hex");

    activeSessions.set(
        sessionToken,
        {
            role: role,
            createdAt: Date.now()
        }
    );

    return sessionToken;
}


/*
=========================================================
GET SESSION TOKEN
=========================================================
*/

function getSessionToken(req) {

    const cookieHeader =
        req.headers.cookie || "";

    const cookies =
        cookieHeader
            .split(";")
            .map(
                item =>
                    item.trim()
            );

    const sessionCookie =
        cookies.find(
            item =>
                item.startsWith(
                    "qpg_session="
                )
        );

    if (!sessionCookie) {
        return null;
    }

    return sessionCookie
        .substring(
            "qpg_session=".length
        );
}


/*
=========================================================
AUTHENTICATION MIDDLEWARE
=========================================================
*/

function requireAuthentication(
    req,
    res,
    next
) {

    const sessionToken =
        getSessionToken(req);

    if (
        !sessionToken ||
        !activeSessions.has(
            sessionToken
        )
    ) {

        return res.status(401).json({
            success: false,
            message:
                "Authentication required."
        });

    }

    req.user =
        activeSessions.get(
            sessionToken
        );

    next();
}


/*
=========================================================
CONNECT MONGODB
=========================================================
*/

let mongoClient = null;


 async function connectDatabase() {

    mongoClient =
        new MongoClient(
            MONGODB_URL
        );

    await mongoClient.connect();

    console.log(
        "MongoDB Connected Successfully!"
    );

    const database =
        mongoClient.db(
            DATABASE_NAME
        );

    return {
        client:
            mongoClient,

        database:
            database
    };
}


/*
=========================================================
SYSTEM SETTINGS
=========================================================
*/

async function getSystemSettings(
    database
) {

    const settingsCollection =
        database.collection(
            SETTINGS_COLLECTION
        );

    let settings =
        await settingsCollection.findOne({
            _id: "main"
        });


    /*
        FIRST TIME SETUP
    */

    if (!settings) {

        const passwordData =
            hashValue("1234");

        const recoveryData =
            hashValue(
                FIXED_RECOVERY_PIN
            );

        settings = {

            _id: "main",

            passwordHash:
                passwordData.hash,

            passwordSalt:
                passwordData.salt,

            recoveryPinHash:
                recoveryData.hash,

            recoveryPinSalt:
                recoveryData.salt,

            createdAt:
                new Date(),

            updatedAt:
                new Date()

        };


        await settingsCollection.insertOne(
            settings
        );


        console.log(
            "===================================="
        );

        console.log(
            "SIMPLE SECURITY SETUP"
        );

        console.log(
            "Default Password: 1234"
        );

        console.log(
            "Recovery PIN:",
            FIXED_RECOVERY_PIN
        );

        console.log(
            "===================================="
        );

    }


    /*
        MIGRATION FOR OLD DATABASE
    */

    if (
        !settings.recoveryPinHash ||
        !settings.recoveryPinSalt
    ) {

        const recoveryData =
            hashValue(
                FIXED_RECOVERY_PIN
            );

        await settingsCollection.updateOne(

            {
                _id: "main"
            },

            {
                $set: {

                    recoveryPinHash:
                        recoveryData.hash,

                    recoveryPinSalt:
                        recoveryData.salt,

                    updatedAt:
                        new Date()

                }
            }

        );

        settings =
            await settingsCollection.findOne({
                _id: "main"
            });

    }


    return settings;
}


/*
=========================================================
UPDATE SYSTEM SETTINGS
=========================================================
*/

async function updateSystemSettings(
    database,
    updates
) {

    const settingsCollection =
        database.collection(
            SETTINGS_COLLECTION
        );

    await settingsCollection.updateOne(

        {
            _id: "main"
        },

        {
            $set: {
                ...updates,
                updatedAt:
                    new Date()
            }
        },

        {
            upsert: true
        }

    );

}


/*
=========================================================
AUTH STATUS
=========================================================
*/

app.get(
    "/api/auth/status",
    function (req, res) {

        const sessionToken =
            getSessionToken(req);

        const authenticated =
            Boolean(
                sessionToken &&
                activeSessions.has(
                    sessionToken
                )
            );

        res.json({
            success: true,
            authenticated:
                authenticated
        });

    }
);


/*
=========================================================
LOGIN
=========================================================
*/

app.post(
    "/api/auth/login",
    async function (req, res) {

        try {

            const database =
                req.app.locals.database;

            const password =
                String(
                    req.body.password ||
                    ""
                );

            if (!password) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password is required."

                });

            }


            const settings =
                await getSystemSettings(
                    database
                );


            const passwordCorrect =
                verifyHash(

                    password,

                    settings.passwordHash,

                    settings.passwordSalt

                );


            if (!passwordCorrect) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Incorrect password."

                });

            }


            const sessionToken =
                createSession(
                    "admin"
                );


            res.setHeader(

                "Set-Cookie",

                "qpg_session=" +
                sessionToken +
                "; HttpOnly; Path=/; SameSite=Strict"

            );


            res.json({

                success: true,

                message:
                    "Login successful."

            });

        } catch (error) {

            console.error(
                "Login Error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Unable to login."

            });

        }

    }
);


/*
=========================================================
LOGOUT
=========================================================
*/

app.post(
    "/api/auth/logout",
    function (req, res) {

        const sessionToken =
            getSessionToken(req);

        if (sessionToken) {

            activeSessions.delete(
                sessionToken
            );

        }

        res.setHeader(

            "Set-Cookie",

            "qpg_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0"

        );


        res.json({

            success: true,

            message:
                "Logged out successfully."

        });

    }
);


/*
=========================================================
CHANGE PASSWORD
=========================================================
*/

app.post(
    "/api/auth/change-password",
    requireAuthentication,
    async function (req, res) {

        try {

            const database =
                req.app.locals.database;

            const currentPassword =
                String(
                    req.body.currentPassword ||
                    ""
                );

            const newPassword =
                String(
                    req.body.newPassword ||
                    ""
                );


            if (
                newPassword.length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password must contain at least 6 characters."

                });

            }


            const settings =
                await getSystemSettings(
                    database
                );


            const currentCorrect =
                verifyHash(

                    currentPassword,

                    settings.passwordHash,

                    settings.passwordSalt

                );


            if (!currentCorrect) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Current password is incorrect."

                });

            }


            const newPasswordData =
                hashValue(
                    newPassword
                );


            await updateSystemSettings(

                database,

                {

                    passwordHash:
                        newPasswordData.hash,

                    passwordSalt:
                        newPasswordData.salt

                }

            );


            res.json({

                success: true,

                message:
                    "Password changed successfully."

            });

        } catch (error) {

            console.error(
                "Change Password Error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Unable to change password."

            });

        }

    }
);


/*
=========================================================
RESET PASSWORD USING FIXED RECOVERY PIN
=========================================================
*/

app.post(
    "/api/auth/reset-password",
    async function (req, res) {

        try {

            const database =
                req.app.locals.database;

            const recoveryPin =
                String(
                    req.body.recoveryPin ||
                    ""
                ).trim();

            const newPassword =
                String(
                    req.body.newPassword ||
                    ""
                );


            if (!recoveryPin) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Recovery PIN is required."

                });

            }


            if (
                newPassword.length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password must contain at least 6 characters."

                });

            }


            const settings =
                await getSystemSettings(
                    database
                );


            const pinCorrect =
                verifyHash(

                    recoveryPin,

                    settings.recoveryPinHash,

                    settings.recoveryPinSalt

                );


            if (!pinCorrect) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Incorrect Recovery PIN."

                });

            }


            const passwordData =
                hashValue(
                    newPassword
                );


            await updateSystemSettings(

                database,

                {

                    passwordHash:
                        passwordData.hash,

                    passwordSalt:
                        passwordData.salt

                }

            );


            const sessionToken =
                createSession(
                    "admin"
                );


            res.setHeader(

                "Set-Cookie",

                "qpg_session=" +
                sessionToken +
                "; HttpOnly; Path=/; SameSite=Strict"

            );


            res.json({

                success: true,

                message:
                    "Password reset successfully."

            });

        } catch (error) {

            console.error(
                "Reset Password Error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Unable to reset password."

            });

        }

    }
);


/*
=========================================================
QUESTION / PAPER HELPER FUNCTIONS
=========================================================
*/

function shuffleArray(
    array
) {

    const result =
        [...array];

    for (
        let i =
            result.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );

        [
            result[i],
            result[j]
        ] = [
            result[j],
            result[i]
        ];

    }

    return result;
}


function getQuestionIds(
    questions
) {

    return questions
        .map(
            question =>
                question &&
                question._id
                    ? new ObjectId(
                        question._id
                    )
                    : null
        )
        .filter(
            id => id !== null
        );

}


/*
=========================================================
ADD PAPER USAGE
=========================================================
*/

async function addPaperUsage(
    database,
    questions,
    paperId,
    paperNumber,
    paperName
) {

    const questionsCollection =
        database.collection(
            COLLECTION_NAME
        );

    const questionIds =
        getQuestionIds(
            questions
        );


    if (
        questionIds.length === 0
    ) {
        return;
    }


    const usageRecord = {

        paperId:
            String(
                paperId
            ),

        paperNumber:
            paperNumber || "",

        paperName:
            paperName || "",

        usedAt:
            new Date()

    };


    await questionsCollection.updateMany(

        {
            _id: {
                $in:
                    questionIds
            }
        },

        {
            $addToSet: {

                usedInPapers:
                    usageRecord

            }
        }

    );

}


/*
=========================================================
REMOVE PAPER USAGE
=========================================================
*/

async function removePaperUsage(
    database,
    paperId
) {

    const questionsCollection =
        database.collection(
            COLLECTION_NAME
        );


    await questionsCollection.updateMany(

        {},

        {

            $pull: {

                usedInPapers: {

                    paperId:
                        String(
                            paperId
                        )

                }

            }

        }

    );

}


/*
=========================================================
BACKUP
=========================================================
*/

app.get(
    "/api/backup",
    requireAuthentication,
    async function (req, res) {

        try {

            const database =
                req.app.locals.database;

            const questions =
                await database
                    .collection(
                        COLLECTION_NAME
                    )
                    .find({})
                    .toArray();

            const papers =
                await database
                    .collection(
                        PAPERS_COLLECTION
                    )
                    .find({})
                    .toArray();

            const settings =
                await getSystemSettings(
                    database
                );


            res.json({

                success: true,

                backup: {

                    version:
                        "1.0",

                    createdAt:
                        new Date(),

                    questions:
                        questions,

                    papers:
                        papers,

                    settings: {

                        passwordHash:
                            settings.passwordHash,

                        passwordSalt:
                            settings.passwordSalt,

                        recoveryPinHash:
                            settings.recoveryPinHash,

                        recoveryPinSalt:
                            settings.recoveryPinSalt

                    }

                }

            });

        } catch (error) {

            console.error(
                "Backup Error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Unable to create backup."

            });

        }

    }
);


/*
=========================================================
RESTORE
=========================================================
*/

app.post(
    "/api/restore",
    requireAuthentication,
    async function (req, res) {

        try {

            const database =
                req.app.locals.database;

            const backup =
                req.body.backup;


            if (!backup) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Backup data is missing."

                });

            }


            const questions =
                Array.isArray(
                    backup.questions
                )
                    ? backup.questions
                    : [];


            const papers =
                Array.isArray(
                    backup.papers
                )
                    ? backup.papers
                    : [];


            const questionsCollection =
                database.collection(
                    COLLECTION_NAME
                );


            const papersCollection =
                database.collection(
                    PAPERS_COLLECTION
                );


            await questionsCollection.deleteMany(
                {}
            );

            await papersCollection.deleteMany(
                {}
            );


            if (
                questions.length > 0
            ) {

                await questionsCollection.insertMany(
                    questions.map(
                        question => {

                            const copy = {
                                ...question
                            };

                            if (
                                copy._id &&
                                typeof copy._id === "string"
                            ) {

                                try {

                                    copy._id =
                                        new ObjectId(
                                            copy._id
                                        );

                                } catch (error) {

                                    delete copy._id;

                                }

                            }

                            return copy;

                        }
                    )
                );

            }


            if (
                papers.length > 0
            ) {

                await papersCollection.insertMany(
                    papers.map(
                        paper => {

                            const copy = {
                                ...paper
                            };

                            if (
                                copy._id &&
                                typeof copy._id === "string"
                            ) {

                                try {

                                    copy._id =
                                        new ObjectId(
                                            copy._id
                                        );

                                } catch (error) {

                                    delete copy._id;

                                }

                            }

                            return copy;

                        }
                    )
                );

            }


            res.json({

                success: true,

                message:
                    "Backup restored successfully."

            });

        } catch (error) {

            console.error(
                "Restore Error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Unable to restore backup."

            });

        }

    }
);
/*
=========================================================
QUESTION SELECTION BY DIFFICULTY
=========================================================
*/

function selectQuestionsByDifficulty(
    questions,
    count,
    difficulty
) {

    if (count <= 0) {
        return [];
    }

    const filtered =
        questions.filter(
            function (question) {

                return (
                    String(
                        question.difficulty || ""
                    ).toLowerCase() ===
                    String(
                        difficulty
                    ).toLowerCase()
                );

            }
        );

    return shuffleArray(
        filtered
    ).slice(
        0,
        count
    );
}


/*
    SAVE QUESTION
    WITH DUPLICATE PROTECTION
*/

app.post(
    "/api/questions",
    async function (req, res) {

        try {

            const questionsCollection =
                req.app.locals.database.collection(
                    COLLECTION_NAME
                );

            /*
                CLEAN / NORMALIZE TEXT
            */

            function normalizeText(value) {

                return String(value || "")
                    .trim()
                    .replace(/\s+/g, " ")
                    .toLowerCase();

            }


            /*
                GET QUESTION DATA
            */

            const semester =
                String(req.body.semester || "").trim();

            const subject =
                String(req.body.subject || "").trim();

            const subjectCode =
                String(req.body.subjectCode || "").trim();

            const unit =
                String(req.body.unit || "").trim();

            const topic =
                String(req.body.topic || "").trim();

            const questionType =
                String(req.body.questionType || "").trim();

            const difficulty =
                String(req.body.difficulty || "").trim();

            const question =
                String(req.body.question || "").trim();

            const answer =
                String(req.body.answer || "").trim();

            const marks =
                Number(req.body.marks);


            /*
                BASIC VALIDATION
            */

            if (
                !semester ||
                !subject ||
                !questionType ||
                !difficulty ||
                !question
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Please fill all required question fields."

                });

            }


            /*
                DUPLICATE CHECK

                Same question is considered duplicate when:

                Subject
                Subject Code
                Unit
                Topic
                Question Type
                Difficulty
                Question Text

                are the same.
            */

            const duplicateQuery = {

                subject:
                    normalizeText(subject),

                subjectCode:
                    normalizeText(subjectCode),

                unit:
                    normalizeText(unit),

                topic:
                    normalizeText(topic),

                questionType:
                    normalizeText(questionType),

                difficulty:
                    normalizeText(difficulty),

                question:
                    normalizeText(question)

            };


            const existingQuestion =
                await questionsCollection.findOne(
                    duplicateQuery
                );


            /*
                DUPLICATE FOUND
            */

            if (existingQuestion) {

                return res.status(409).json({

                    success: false,

                    duplicate: true,

                    message:
                        "This question already exists in the Question Bank.",

                    questionId:
                        existingQuestion._id

                });

            }


            /*
                SAVE QUESTION

                Keep original display values.
            */

            const questionData = {

                semester:
                    semester,

                subject:
                    subject,

                subjectCode:
                    subjectCode,

                unit:
                    unit,

                topic:
                    topic,

                questionType:
                    questionType,

                difficulty:
                    difficulty,

                marks:
                    marks,

                question:
                    question,

                answer:
                    answer,

                createdAt:
                    new Date(),

                updatedAt:
                    new Date(),

                usedInPapers:
                    []

            };


            /*
                INSERT NEW QUESTION
            */

            const result =
                await questionsCollection.insertOne(
                    questionData
                );


            /*
                SUCCESS RESPONSE
            */

            res.status(201).json({

                success: true,

                duplicate: false,

                message:
                    "Question saved successfully!",

                questionId:
                    result.insertedId

            });


        } catch (error) {

            console.error(
                "Error saving question:",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Failed to save question."

            });

        }

    }
);


/*
=========================================================
PAPERFORGE AI QUESTION GENERATOR - OLLAMA
=========================================================
*/

app.post(
    "/api/generate-ai-questions",
    requireAuthentication,
    async function (req, res) {
        try {
            const database = req.app.locals.database;
            const questionsCollection =
                database.collection(COLLECTION_NAME);

            const course = String(req.body.course || "").trim();
            const semester = String(req.body.semester || "").trim();
            const subject = String(req.body.subject || "").trim();
            const subjectCode = String(req.body.subjectCode || "").trim();
            const unit = String(req.body.unit || "").trim();
            const topic = String(req.body.topic || "").trim();
const questionType = String(req.body.questionType || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
            console.log("Received questionType:", JSON.stringify(questionType));
            const difficulty = String(req.body.difficulty || "").trim();
            const quantity = Number(req.body.quantity);
            const marks = Number(req.body.marks || 2);


            const allowedDifficulties = [
                "Easy",
                "Medium",
                "Hard"
            ];

            if (!semester || !subject || !questionType || !difficulty) {
                return res.status(400).json({
                    success: false,
                    message: "Semester, subject, question type and difficulty are required."
                });
            }
            console.log("Received questionType:", JSON.stringify(questionType));
            const normalizedQuestionType = questionType
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const allowedTypeMap = {
    "short answer": "Short Answer",
    "long answer": "Long Answer",
    "numerical": "Numerical",
    "programming / code based": "Programming / Code Based",
    "case study": "Case Study",
    "case study / application based": "Case Study / Application Based",
    "mcq": "MCQ",
    "mcq questions": "MCQ",
    "subjective questions": "Subjective Questions",
    "subjective": "Subjective Questions",
    "combined questions": "Combined Questions",
    "combined": "Combined Questions",
    "mixed": "Combined Questions"
};

const normalizedType =
    allowedTypeMap[normalizedQuestionType];
    console.log("QUESTION TYPE:", JSON.stringify(questionType));
console.log("NORMALIZED TYPE:", normalizedType);

if (!normalizedType) {
    return res.status(400).json({
        success: false,
        message: "Unsupported question type: " + questionType
    });
}
            if (!allowedDifficulties.includes(difficulty)) {
                return res.status(400).json({
                    success: false,
                    message: "Difficulty must be Easy, Medium or Hard."
                });
            }
if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 100
) {
    return res.status(400).json({
        success: false,
        message: "Generate between 1 and 100 questions per request."
    });
}

            if (!Number.isFinite(marks) || marks <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Marks must be a positive number."
                });
            }
const existingQuestions = await questionsCollection.find({
    semester: semester,
    subject: subject
}).project({
    question: 1,
    _id: 0
}).toArray();

const existingQuestionTexts = existingQuestions
    .map(item => String(item.question || "").trim())
    .filter(Boolean);

const recentQuestionsToAvoid = existingQuestionTexts
    .slice(-40)
    .map(question => "- " + question)
    .join("\n");
            const systemPrompt = `
You are PaperForge AI, an expert BCA question-paper creator.
Generate original academic questions in simple, correct English.

Return ONLY a valid JSON object in this exact structure:
{
  "questions": [
    {
      "question": "Question text",
      "answer": "Correct answer or solution"
    }
  ]
}

Generate exactly the requested number of questions.
Questions must match the given subject, unit, topic, type and difficulty.
Do not repeat questions within your response.
Never reproduce any question listed in the user's
previously used questions.
Create genuinely different questions, not just
minor wording changes.
If a topic has many possibilities, explore different
concepts, examples, and applications.
Do not include Markdown or text outside the JSON object.
Answers must be accurate and suitable for BCA students.
For programming questions, provide a clear coding problem and an appropriate answer.
For numerical questions, include the correct solution.
`;

const userPrompt = `
Course: ${course || "Not specified"}
Semester: ${semester}
Subject: ${subject}
Subject code: ${subjectCode || "Not specified"}
Unit: ${unit || "Any relevant unit"}
Topic: ${topic || "Any relevant topic"}
Question type: ${normalizedType}
Difficulty: ${difficulty}
Marks per question: ${marks}
Number of questions: ${quantity}
Previously used questions to avoid:
${recentQuestionsToAvoid || "No previous questions provided."}
Language: English
`;

            const ollamaUrl = "http://127.0.0.1:11434/api/chat";

function normalizeQuestion(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

const existingTexts = new Set(
    existingQuestions.map(item => normalizeQuestion(item.question))
);

const newQuestions = [];
const maxGenerationAttempts = 12;
let generationAttempts = 0;

while (
    newQuestions.length < quantity &&
    generationAttempts < maxGenerationAttempts
) {
    generationAttempts++;

    const batchQuantity = Math.min(
        10,
        quantity - newQuestions.length
    );

    const excludedQuestions = [
        ...existingQuestions.map(item => item.question),
        ...newQuestions.map(item => item.question)
    ].filter(Boolean).slice(-100);

    const retryPrompt = `
${userPrompt.replace(
    `Number of questions: ${quantity}`,
    `Number of questions: ${batchQuantity}`
)}

Generate exactly ${batchQuantity} NEW questions.

Do not repeat or rephrase these existing questions:
${excludedQuestions.length
    ? excludedQuestions.map(q => "- " + q).join("\n")
    : "No existing questions provided."}

Explore different concepts, examples and applications.
Return only the required JSON object.
`;

    const controller = new AbortController();
    const timeoutId = setTimeout(
        () => controller.abort(),
        120000
    );

    try {
        const response = await fetch(ollamaUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            signal: controller.signal,
            body: JSON.stringify({
                model: "qwen2.5:3b",
                format: "json",
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: retryPrompt
                    }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            const details = await response.text();
            throw new Error(
                `Ollama HTTP ${response.status}: ${details.slice(0, 300)}`
            );
        }

        const data = await response.json();
        const rawReply = data.message?.content || "{}";
        const parsedReply = JSON.parse(rawReply);

        if (!Array.isArray(parsedReply.questions)) {
            throw new Error(
                "AI response did not contain a questions array."
            );
        }

        let addedThisAttempt = 0;

        for (const item of parsedReply.questions) {
            if (newQuestions.length >= quantity) break;

            const questionText = String(
                item.question || ""
            ).trim();

            const answerText = String(
                item.answer || ""
            ).trim();

            const normalizedText =
                normalizeQuestion(questionText);

            if (
                !questionText ||
                !answerText ||
                existingTexts.has(normalizedText)
            ) {
                continue;
            }

            existingTexts.add(normalizedText);

            newQuestions.push({
                source: "AI",
                course,
                semester,
                subject,
                subjectCode,
                unit,
                topic,
                questionType,
                difficulty,
                marks,
                question: questionText,
                answer: answerText,
                createdAt: new Date(),
                updatedAt: new Date(),
                usedInPapers: []
            });

            addedThisAttempt++;
        }

        console.log(
            `PaperForge attempt ${generationAttempts}: ` +
            `${addedThisAttempt} new questions; ` +
            `${newQuestions.length}/${quantity} collected.`
        );

    } catch (error) {
        console.error(
            `PaperForge generation attempt ${generationAttempts}:`,
            error.message
        );

        if (
            error.name === "AbortError" ||
            error.message.includes("Ollama HTTP")
        ) {
            throw error;
        }
    } finally {
        clearTimeout(timeoutId);
    }
}

console.log(
    `PaperForge final result: ${newQuestions.length}/${quantity} unique questions`
);

if (newQuestions.length === 0) {
    return res.status(200).json({
        success: true,
        message: "AI generated no new unique questions. Try another topic or difficulty.",
        requested: quantity,
        saved: 0,
        questions: []
    });
}

const result = await questionsCollection.insertMany(newQuestions);

res.status(201).json({
    success: true,
    message: "AI questions generated and saved successfully.",
    requested: quantity,
    saved: result.insertedCount,
    questions: newQuestions
});

} catch (error) {
    console.error("PaperForge AI Question Generator Error:", error);

    const isTimeout = error.name === "AbortError";
    const isConnectionError =
        error.cause?.code === "ECONNREFUSED" ||
        error.cause?.code === "ECONNRESET" ||
        error.message.includes("Ollama unavailable");

    let message = "AI question generation failed. Check the server terminal for details.";

    if (isTimeout) {
        message = "Ollama took too long to respond. Please try again.";
    } else if (isConnectionError) {
        message = "Ollama is not reachable. Please wait a few seconds and try again.";
    } else if (error.message.includes("invalid JSON")) {
        message = "AI returned an invalid response. Please try generating again.";
    }

           if (!res.headersSent) {
        res.status(502).json({
            success: false,
            message
        });
    }
    }
    }
);
/*
=========================================================
GET ALL QUESTIONS
=========================================================
*/

app.get(
    "/api/questions",
    async function (req, res) {

        try {

            const questionsCollection =
                req.app.locals.database.collection(
                    COLLECTION_NAME
                );

            const questions =
                await questionsCollection
                    .find({})
                    .sort({
                        createdAt: -1
                    })
                    .toArray();

            res.json({

                success: true,

                questions:
                    questions

            });

        } catch (error) {

            console.error(
                "Error loading questions:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to load questions."

            });

        }

    }
);


/*
=========================================================
GET SINGLE QUESTION
=========================================================
*/

app.get(
    "/api/questions/:id",
    async function (req, res) {

        try {

            const questionId =
                req.params.id;

            if (
                !ObjectId.isValid(
                    questionId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid question ID."

                });

            }

            const questionsCollection =
                req.app.locals.database.collection(
                    COLLECTION_NAME
                );

            const question =
                await questionsCollection.findOne({

                    _id:
                        new ObjectId(
                            questionId
                        )

                });

            if (!question) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Question not found."

                });

            }

            res.json({

                success: true,

                question:
                    question

            });

        } catch (error) {

            console.error(
                "Error loading question:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to load question."

            });

        }

    }
);


/*
=========================================================
UPDATE QUESTION
=========================================================
*/

app.put(
    "/api/questions/:id",
    async function (req, res) {

        try {

            const questionId =
                req.params.id;

            if (
                !ObjectId.isValid(
                    questionId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid question ID."

                });

            }

            const questionsCollection =
                req.app.locals.database.collection(
                    COLLECTION_NAME
                );

            const updatedQuestion = {

                semester:
                    req.body.semester,

                subject:
                    req.body.subject,

                subjectCode:
                    req.body.subjectCode || "",

                unit:
                    req.body.unit,

                topic:
                    req.body.topic || "",

                questionType:
                    req.body.questionType,

                difficulty:
                    req.body.difficulty,

                marks:
                    Number(
                        req.body.marks
                    ),

                question:
                    req.body.question,

                answer:
                    req.body.answer || ""

            };

            const result =
                await questionsCollection.updateOne(

                    {
                        _id:
                            new ObjectId(
                                questionId
                            )
                    },

                    {
                        $set:
                            updatedQuestion
                    }

                );

            if (
                result.matchedCount === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Question not found."

                });

            }

            res.json({

                success: true,

                message:
                    "Question updated successfully!"

            });

        } catch (error) {

            console.error(
                "Error updating question:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to update question."

            });

        }

    }
);


/*
=========================================================
DELETE QUESTION
=========================================================
*/

app.delete(
    "/api/questions/:id",
    async function (req, res) {

        try {

            const questionId =
                req.params.id;

            if (
                !ObjectId.isValid(
                    questionId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid question ID."

                });

            }

            const questionsCollection =
                req.app.locals.database.collection(
                    COLLECTION_NAME
                );

            const result =
                await questionsCollection.deleteOne({

                    _id:
                        new ObjectId(
                            questionId
                        )

                });

            if (
                result.deletedCount === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Question not found."

                });

            }

            res.json({

                success: true,

                message:
                    "Question deleted successfully!"

            });

        } catch (error) {

            console.error(
                "Error deleting question:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to delete question."

            });

        }

    }
);


/*
=========================================================
GENERATE QUESTION PAPER
SUBJECTIVE QUESTIONS ONLY
=========================================================
*/

app.post(
    "/api/generate-paper",
    async function (req, res) {

        try {

            const questionsCollection =
                req.app.locals.database.collection(
                    COLLECTION_NAME
                );

            const semester =
                req.body.semester;

            const subject =
                req.body.subject;

            const easyPercentage =
                Number(
                    req.body.easyPercentage
                );

            const mediumPercentage =
                Number(
                    req.body.mediumPercentage
                );

            const hardPercentage =
                Number(
                    req.body.hardPercentage
                );

            const shortAnswerCount =
                Number(
                    req.body.shortAnswerCount || 0
                );

            const longAnswerCount =
                Number(
                    req.body.longAnswerCount || 0
                );

            const numericalCount =
                Number(
                    req.body.numericalCount || 0
                );

            const programmingCount =
                Number(
                    req.body.programmingCount || 0
                );

            const caseStudyCount =
                Number(
                    req.body.caseStudyCount || 0
                );

            const totalQuestions =
                shortAnswerCount +
                longAnswerCount +
                numericalCount +
                programmingCount +
                caseStudyCount;


            if (
                !semester ||
                !subject
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Semester and Subject are required."

                });

            }


           const difficultyTotal =
    Number(easyPercentage) +
    Number(mediumPercentage) +
    Number(hardPercentage);

if (
    !Number.isFinite(difficultyTotal) ||
    Math.abs(difficultyTotal - 100) > 0.01
) {
    return res.status(400).json({
        success: false,
        message:
            "Difficulty percentages must total 100%."
    });
}

            if (
                totalQuestions === 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "At least one question is required."

                });

            }

const allowedTypes = [
    "MCQ",
    "Short Answer",
    "Long Answer",
    "Numerical",
    "Programming / Code Based",
    "Case Study",
    "Case Study / Application Based"
];

            const availableQuestions =
                await questionsCollection
                    .find({

                        semester:
                            semester,

                        subject:
                            subject,

                        questionType:
                            {
                                $in:
                                    allowedTypes
                            }

                    })
                    .toArray();


            if (
                availableQuestions.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "No subjective questions are available for this subject. Please add questions to the Question Bank."

                });

            }


            /*
                FIRST TRY UNUSED QUESTIONS
            */

            const unusedQuestions =
                availableQuestions.filter(

                    function (question) {

                        return (
                            !Array.isArray(
                                question.usedInPapers
                            ) ||
                            question.usedInPapers.length === 0
                        );

                    }

                );


            let sourceQuestions;


            if (
                unusedQuestions.length >=
                totalQuestions
            ) {

                sourceQuestions =
                    unusedQuestions;

            } else {

                sourceQuestions =
                    availableQuestions;

            }


            /*
                DIFFICULTY COUNTS
            */

            let easyCount =
                Math.round(
                    totalQuestions *
                    easyPercentage /
                    100
                );

            let mediumCount =
                Math.round(
                    totalQuestions *
                    mediumPercentage /
                    100
                );

            let hardCount =
                totalQuestions -
                easyCount -
                mediumCount;


            const selectedQuestions = [];


            /*
                ADD QUESTIONS WITHOUT DUPLICATES
            */

            function addQuestions(
                questionList
            ) {

                questionList.forEach(

                    function (question) {

                        if (
                            selectedQuestions.length >=
                            totalQuestions
                        ) {

                            return;

                        }


                        const alreadySelected =
                            selectedQuestions.some(

                                function (selected) {

                                    return (

                                        String(
                                            selected._id
                                        ) ===
                                        String(
                                            question._id
                                        )

                                    );

                                }

                            );


                        if (
                            !alreadySelected
                        ) {

                            selectedQuestions.push(
                                question
                            );

                        }

                    }

                );

            }


            /*
                EASY
            */

            addQuestions(

                selectQuestionsByDifficulty(

                    sourceQuestions,

                    easyCount,

                    "Easy"

                )

            );


            /*
                MEDIUM
            */

            addQuestions(

                selectQuestionsByDifficulty(

                    sourceQuestions,

                    mediumCount,

                    "Medium"

                )

            );


            /*
                HARD
            */

            addQuestions(

                selectQuestionsByDifficulty(

                    sourceQuestions,

                    hardCount,

                    "Hard"

                )

            );


            /*
                FILL REMAINING QUESTIONS
            */

            if (
                selectedQuestions.length <
                totalQuestions
            ) {

                addQuestions(

                    shuffleArray(
                        sourceQuestions
                    )

                );

            }


            /*
                NOT ENOUGH QUESTIONS
            */

            if (
                selectedQuestions.length <
                totalQuestions
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Not enough suitable questions are available. Please add more questions to the Question Bank.",

                    required:
                        totalQuestions,

                    available:
                        selectedQuestions.length

                });

            }


            /*
                FINAL SHUFFLE
            */

            const finalQuestions =
                shuffleArray(
                    selectedQuestions
                );


            res.json({

                success: true,

                message:
                    "Question paper generated successfully.",

                totalQuestions:
                    finalQuestions.length,

                questions:
                    finalQuestions

            });


        } catch (error) {

            console.error(
                "Error generating paper:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to generate question paper."

            });

        }

    }
);
/*
=========================================================
SAVE GENERATED QUESTION PAPER
=========================================================
*/

app.post(
    "/api/save-paper",
    requireAuthentication,
    async function (req, res) {

        try {

            const database =
                req.app.locals.database;

            const papersCollection =
                database.collection(
                    PAPERS_COLLECTION
                );

            const paperName =
                req.body.paperName;

            const subject =
                req.body.subject;

            const semester =
                req.body.semester;

            const questions =
                req.body.questions;


            if (
                !paperName ||
                !subject ||
                !semester ||
                !Array.isArray(questions) ||
                questions.length === 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Paper name, subject, semester and questions are required."

                });

            }


            /*
                FIND NEXT PAPER NUMBER
            */

            const previousPaper =
                await papersCollection
                    .find({})
                    .sort({
                        paperNumber: -1
                    })
                    .limit(1)
                    .toArray();


            let nextNumber = 1;


            if (
                previousPaper.length > 0 &&
                previousPaper[0].paperNumber
            ) {

                const previousNumber =
                    parseInt(
                        String(
                            previousPaper[0].paperNumber
                        ).replace(
                            /[^0-9]/g,
                            ""
                        ),
                        10
                    );


                if (
                    !isNaN(
                        previousNumber
                    )
                ) {

                    nextNumber =
                        previousNumber + 1;

                }

            }


            const paperNumber =
                "Paper " +
                String(
                    nextNumber
                ).padStart(
                    3,
                    "0"
                );


            const paper = {

                paperNumber:
                    paperNumber,

                paperName:
                    paperName,

                subject:
                    subject,

                semester:
                    semester,

                questions:
                    questions,

                createdAt:
                    new Date(),

                updatedAt:
                    new Date()

            };


            const result =
                await papersCollection.insertOne(
                    paper
                );


            /*
                MARK QUESTIONS AS USED
            */

            await addPaperUsage(

                database,

                questions,

                result.insertedId,

                paperNumber,

                paperName

            );


            res.status(201).json({

                success: true,

                message:
                    "Question paper saved successfully.",

                paperId:
                    result.insertedId,

                paperNumber:
                    paperNumber

            });


        } catch (error) {

            console.error(
                "Error saving paper:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to save question paper."

            });

        }

    }
);


/*
=========================================================
GET ALL PREVIOUS PAPERS
=========================================================
*/

app.get(
    "/api/papers",
    requireAuthentication,
    async function (req, res) {

        try {

            const papersCollection =
                req.app.locals.database.collection(
                    PAPERS_COLLECTION
                );

            const papers =
                await papersCollection
                    .find({})
                    .sort({
                        createdAt: -1
                    })
                    .toArray();


            res.json({

                success: true,

                papers:
                    papers

            });


        } catch (error) {

            console.error(
                "Error loading papers:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to load previous papers."

            });

        }

    }
);

// SAVE GENERATED QUESTION PAPER
app.post(
    "/api/papers",
    requireAuthentication,
    async function (req, res) {
        try {
            const papersCollection =
                req.app.locals.database.collection(
                    PAPERS_COLLECTION
                );

            const data = req.body.paper || req.body;

            if (
                !data ||
                typeof data !== "object" ||
                Object.keys(data).length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "No question paper data received."
                });
            }

            const paper = {
                ...data,
                createdAt: new Date()
            };

            const result =
                await papersCollection.insertOne(paper);

            res.status(201).json({
                success: true,
                message: "Question paper saved successfully.",
                paper: {
                    ...paper,
                    _id: result.insertedId
                }
            });
        } catch (error) {
            console.error("Save paper error:", error);

            res.status(500).json({
                success: false,
                message: "Failed to save question paper."
            });
        }
    }
); 

/*
=========================================================
GET SINGLE PAPER
=========================================================
*/

app.get(
    "/api/papers/:id",
    requireAuthentication,
    async function (req, res) {

        try {

            const paperId =
                req.params.id;


            if (
                !ObjectId.isValid(
                    paperId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid paper ID."

                });

            }


            const papersCollection =
                req.app.locals.database.collection(
                    PAPERS_COLLECTION
                );


            const paper =
                await papersCollection.findOne({

                    _id:
                        new ObjectId(
                            paperId
                        )

                });


            if (!paper) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Paper not found."

                });

            }


            res.json({

                success: true,

                paper:
                    paper

            });


        } catch (error) {

            console.error(
                "Error loading paper:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to load paper."

            });

        }

    }
);


/*
=========================================================
UPDATE PREVIOUS PAPER
=========================================================
*/

app.put(
    "/api/papers/:id",
    requireAuthentication,
    async function (req, res) {

        try {

            const paperId =
                req.params.id;


            if (
                !ObjectId.isValid(
                    paperId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid paper ID."

                });

            }


            const papersCollection =
                req.app.locals.database.collection(
                    PAPERS_COLLECTION
                );


            const oldPaper =
                await papersCollection.findOne({

                    _id:
                        new ObjectId(
                            paperId
                        )

                });


            if (!oldPaper) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Paper not found."

                });

            }


            /*
                REMOVE OLD USAGE
            */

            await removePaperUsage(

                req.app.locals.database,

                paperId

            );


            const updatedPaper = {

                paperName:
                    req.body.paperName ||
                    oldPaper.paperName,

                subject:
                    req.body.subject ||
                    oldPaper.subject,

                semester:
                    req.body.semester ||
                    oldPaper.semester,

                questions:
                    Array.isArray(
                        req.body.questions
                    )
                        ? req.body.questions
                        : oldPaper.questions,

                updatedAt:
                    new Date()

            };


            await papersCollection.updateOne(

                {
                    _id:
                        new ObjectId(
                            paperId
                        )
                },

                {
                    $set:
                        updatedPaper
                }

            );


            /*
                ADD NEW USAGE
            */

            await addPaperUsage(

                req.app.locals.database,

                updatedPaper.questions,

                paperId,

                oldPaper.paperNumber,

                updatedPaper.paperName

            );


            res.json({

                success: true,

                message:
                    "Paper updated successfully."

            });


        } catch (error) {

            console.error(
                "Error updating paper:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to update paper."

            });

        }

    }
);


/*
=========================================================
DELETE PREVIOUS PAPER
=========================================================
*/

app.delete(
    "/api/papers/:id",
    requireAuthentication,
    async function (req, res) {

        try {

            const paperId =
                req.params.id;


            if (
                !ObjectId.isValid(
                    paperId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid paper ID."

                });

            }


            const papersCollection =
                req.app.locals.database.collection(
                    PAPERS_COLLECTION
                );


            const paper =
                await papersCollection.findOne({

                    _id:
                        new ObjectId(
                            paperId
                        )

                });


            if (!paper) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Paper not found."

                });

            }


            /*
                REMOVE QUESTION USAGE
            */

            await removePaperUsage(

                req.app.locals.database,

                paperId

            );


            /*
                DELETE PAPER
            */

            await papersCollection.deleteOne({

                _id:
                    new ObjectId(
                        paperId
                    )

            });


            res.json({

                success: true,

                message:
                    "Paper deleted successfully."

            });


        } catch (error) {

            console.error(
                "Error deleting paper:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to delete paper."

            });

        }

    }
);
// ===============================
// COURSE MANAGEMENT API
// ===============================

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Admin access required."
        });
    }

    next();
}

// Get all courses
console.log("REGISTERING COURSE ROUTES");
 
app.get(
    "/api/admin/courses",
    requireAuthentication,
    requireAdmin,
    async function (req, res) {
        try {
            const courses = req.app.locals.database
                .collection("courses");

            const result = await courses
                .find({})
                .sort({ name: 1 })
                .toArray();

            res.json({
                success: true,
                courses: result
            });
        } catch (error) {
            console.error("Get courses error:", error);
            res.status(500).json({
                success: false,
                message: "Could not load courses."
            });
        }
    }
);

// Add a course
app.post(
    "/api/admin/courses",
    requireAuthentication,
    requireAdmin,
    async function (req, res) {
        try {
            const courses = req.app.locals.database
                .collection("courses");

            const code = String(req.body.code || "")
                .trim()
                .toUpperCase();

            const name = String(req.body.name || "").trim();
            const description = String(req.body.description || "").trim();

            if (!code || !name) {
                return res.status(400).json({
                    success: false,
                    message: "Course code and name are required."
                });
            }

            const existing = await courses.findOne({ code });

            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: "This course code already exists."
                });
            }

            const course = {
                code,
                name,
                description,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await courses.insertOne(course);

            res.status(201).json({
                success: true,
                message: "Course added successfully.",
                course: {
                    ...course,
                    _id: result.insertedId
                }
            });
        } catch (error) {
            console.error("Add course error:", error);
            res.status(500).json({
                success: false,
                message: "Could not add course."
            });
        }
    }
);

// Edit a course
app.put(
    "/api/admin/courses/:id",
    requireAuthentication,
    requireAdmin,
    async function (req, res) {
        try {
            if (!ObjectId.isValid(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid course ID."
                });
            }

            const courses = req.app.locals.database
                .collection("courses");

            const id = new ObjectId(req.params.id);
            const code = String(req.body.code || "")
                .trim()
                .toUpperCase();
            const name = String(req.body.name || "").trim();
            const description = String(req.body.description || "").trim();

            if (!code || !name) {
                return res.status(400).json({
                    success: false,
                    message: "Course code and name are required."
                });
            }

            const duplicate = await courses.findOne({
                code,
                _id: { $ne: id }
            });

            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message: "Another course uses this code."
                });
            }

            const result = await courses.updateOne(
                { _id: id },
                {
                    $set: {
                        code,
                        name,
                        description,
                        updatedAt: new Date()
                    }
                }
            );

            if (!result.matchedCount) {
                return res.status(404).json({
                    success: false,
                    message: "Course not found."
                });
            }

            res.json({
                success: true,
                message: "Course updated successfully."
            });
        } catch (error) {
            console.error("Edit course error:", error);
            res.status(500).json({
                success: false,
                message: "Could not update course."
            });
        }
    }
);

// Activate or deactivate a course
app.patch(
    "/api/admin/courses/:id/status",
    requireAuthentication,
    requireAdmin,
    async function (req, res) {
        try {
            if (!ObjectId.isValid(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid course ID."
                });
            }

            if (typeof req.body.isActive !== "boolean") {
                return res.status(400).json({
                    success: false,
                    message: "isActive must be true or false."
                });
            }

            const courses = req.app.locals.database
                .collection("courses");

            const result = await courses.updateOne(
                { _id: new ObjectId(req.params.id) },
                {
                    $set: {
                        isActive: req.body.isActive,
                        updatedAt: new Date()
                    }
                }
            );

            if (!result.matchedCount) {
                return res.status(404).json({
                    success: false,
                    message: "Course not found."
                });
            }

            res.json({
                success: true,
                message: req.body.isActive
                    ? "Course activated."
                    : "Course deactivated."
            });
        } catch (error) {
            console.error("Course status error:", error);
            res.status(500).json({
                success: false,
                message: "Could not change course status."
            });
        }
    }
);

/* ===============================
   SEMESTER MANAGEMENT API
================================ */

// Get semesters for a course
app.get(
    "/api/admin/semesters",
    requireAuthentication,
    requireAdmin,
    async function (req, res) {
        try {
            const courseId = String(req.query.courseId || "").trim();

            if (!ObjectId.isValid(courseId)) {
                return res.status(400).json({
                    success: false,
                    message: "Valid courseId is required."
                });
            }

            const database = req.app.locals.database;
            const course = await database.collection("courses").findOne({
                _id: new ObjectId(courseId)
            });

            if (!course) {
                return res.status(404).json({
                    success: false,
                    message: "Course not found."
                });
            }

            const semesters = await database
                .collection("semesters")
                .find({ courseId: new ObjectId(courseId) })
                .sort({ semesterNumber: 1 })
                .toArray();

            res.json({ success: true, semesters });
        } catch (error) {
            console.error("Get semesters error:", error);
            res.status(500).json({
                success: false,
                message: "Could not load semesters."
            });
        }
    }
);

// Add a semester
app.post(
    "/api/admin/semesters",
    requireAuthentication,
    requireAdmin,
    async function (req, res) {
        try {
            const database = req.app.locals.database;
            const courseId = String(req.body.courseId || "").trim();
            const semesterNumber = Number(req.body.semesterNumber);
            const name = String(req.body.name || "").trim();

            if (
                !ObjectId.isValid(courseId) ||
                !Number.isInteger(semesterNumber) ||
                semesterNumber < 1 ||
                !name
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Valid course, semester number and name are required."
                });
            }

            const courseObjectId = new ObjectId(courseId);
            const course = await database.collection("courses").findOne({
                _id: courseObjectId
            });

            if (!course) {
                return res.status(404).json({
                    success: false,
                    message: "Course not found."
                });
            }

            const semesters = database.collection("semesters");
            const existing = await semesters.findOne({
                courseId: courseObjectId,
                semesterNumber
            });

            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: "This semester already exists for the course."
                });
            }

            const semester = {
                courseId: courseObjectId,
                courseCode: course.code,
                semesterNumber,
                name,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await semesters.insertOne(semester);

            res.status(201).json({
                success: true,
                message: "Semester added successfully.",
                semester: { ...semester, _id: result.insertedId }
            });
        } catch (error) {
            console.error("Add semester error:", error);
            res.status(500).json({
                success: false,
                message: "Could not add semester."
            });
        }
    }
);

// Activate or deactivate a semester
app.patch(
    "/api/admin/semesters/:id/status",
    requireAuthentication,
    requireAdmin,
    async function (req, res) {
        try {
            const semesterId = req.params.id;

            if (!ObjectId.isValid(semesterId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid semester ID."
                });
            }

            if (typeof req.body.isActive !== "boolean") {
                return res.status(400).json({
                    success: false,
                    message: "isActive must be true or false."
                });
            }

            const result = await req.app.locals.database
                .collection("semesters")
                .updateOne(
                    { _id: new ObjectId(semesterId) },
                    {
                        $set: {
                            isActive: req.body.isActive,
                            updatedAt: new Date()
                        }
                    }
                );

            if (!result.matchedCount) {
                return res.status(404).json({
                    success: false,
                    message: "Semester not found."
                });
            }

            res.json({
                success: true,
                message: req.body.isActive
                    ? "Semester activated."
                    : "Semester deactivated."
            });
        } catch (error) {
            console.error("Semester status error:", error);
            res.status(500).json({
                success: false,
                message: "Could not update semester status."
            });
        }
    }
);


/* =========================================
   PAPERFORGE LOCAL AI CHATBOT - OLLAMA
========================================= */

app.post(
    "/api/chat/ollama",
    requireAuthentication,
    async function (req, res) {
        try {
            const message = String(req.body.message || "").trim();
            const mode = req.body.mode === "practice" ? "practice" : "study";

const systemPrompt = mode === "practice"
    ? "You are PaperForge AI, a BCA exam practice assistant. Give practice questions on the user's requested topic in simple English. Number each question clearly. Include the correct answer and a brief explanation after each question. If the user specifies a number of questions, follow it; otherwise give 5 questions. Do not use Markdown asterisks."
    : "You are PaperForge AI, a BCA study assistant. Explain academic topics in simple English with clear headings and numbered points when useful. Give examples relevant to BCA students. Keep answers accurate and exam-friendly. Do not use Markdown asterisks.";

            if (!message) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a message."
                });
            }

            if (message.length > 2000) {
                return res.status(400).json({
                    success: false,
                    message: "Message is too long."
                });
            }

            const response = await fetch(
                "http://127.0.0.1:11434/api/chat",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "qwen2.5:3b",
                       messages: [
    {
        role: "system",
        content: systemPrompt
    },
                            {
                                role: "user",
                                content: message
                            }
                        ],
                       stream: false,
options: {
    temperature: 0.4,
    repeat_penalty: 1.15,
    num_predict: 2048
}
                    })
                }
            );

            if (!response.ok) {
                throw new Error("Ollama HTTP " + response.status);
            }

         const data = await response.json();
const rawReply = data.message?.content || "No response received.";

const cleanReply = rawReply
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s*[*+-]\s+/gm, "")
    .trim();

res.json({
    success: true,
    reply: cleanReply
});
        } catch (error) {
            console.error("PaperForge AI Error:", error);

            res.status(502).json({
                success: false,
                message: "AI could not respond. Check that Ollama is running."
            });
        }
    }
);

/*
=========================================================
SERVER START
=========================================================
*/

async function startServer() {

    try {

        console.log(
            "START SERVER FUNCTION CALLED"
        );


        const connection =
            await connectDatabase();


        console.log(
            "DATABASE CONNECTION COMPLETED"
        );


        const database =
            connection.database;


        app.locals.database =
            database;


        await getSystemSettings(
            database
        );


        console.log(
            "SYSTEM SETTINGS COMPLETED"
        );


        const server =
        console.log("REGISTERED ROUTES CHECK");
        console.log(
    "CHATBOT ROUTE CHECK:",
    app.router.stack
        .filter(layer => layer.route)
        .map(layer => ({
            path: layer.route.path,
            methods: layer.route.methods
        }))
        .filter(route => String(route.path).includes("/api/chat/ollama"))
);
    app.listen(
        PORT,
        "0.0.0.0",
        function () {
                    console.log(
                        "Server is running at http://localhost:" +
                        PORT
                    );

                    
                }
            );


    } catch (error) {

        console.error(
            "SERVER START ERROR:",
            error
        );

        process.exit(
            1
        );

    }

}

console.log("COURSE API BLOCK LOADED");
console.log(
    "COURSE ROUTE CHECK:",
    app.router.stack
        .filter(layer => layer.route)
        .map(layer => ({
            path: layer.route.path,
            methods: layer.route.methods
        }))
        .filter(route =>
            String(route.path).includes("/api/admin/courses")
        )
);
startServer();