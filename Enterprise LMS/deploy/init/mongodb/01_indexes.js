// MongoDB init: create indexes for LMS collections
db = db.getSiblingDB("enterprise_lms");

// LessonContent
db.createCollection("lessoncontents");
db.lessoncontents.createIndex({ lessonId: 1, schoolId: 1 }, { unique: true });

// QuizContent
db.createCollection("quizcontents");
db.quizcontents.createIndex({ lessonId: 1, schoolId: 1 }, { unique: true });

// UserProgress
db.createCollection("userprogresses");
db.userprogresses.createIndex({ userId: 1, lessonId: 1 }, { unique: true });
db.userprogresses.createIndex({ userId: 1, courseId: 1 });

// AiChat
db.createCollection("aichats");
db.aichats.createIndex({ userId: 1, sessionId: 1 });
db.aichats.createIndex({ createdAt: -1 });

print("MongoDB indexes created successfully");
