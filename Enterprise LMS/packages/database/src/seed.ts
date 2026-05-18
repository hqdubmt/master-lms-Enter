import { PrismaClient, Role, Plan, CourseStatus, LessonContentType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(plain: string) {
  return bcrypt.hash(plain, 12);
}

async function main() {
  console.log("🌱 Seeding Enterprise LMS...\n");

  // ─── Schools ─────────────────────────────────────────────
  const schools = await Promise.all([
    prisma.school.upsert({
      where: { domain: "thanglong.edu.vn" },
      update: {},
      create: {
        name: "Trường THPT Thăng Long",
        domain: "thanglong.edu.vn",
        plan: Plan.PRO,
      },
    }),
    prisma.school.upsert({
      where: { domain: "aiacademy.vn" },
      update: {},
      create: {
        name: "AI Academy Việt Nam",
        domain: "aiacademy.vn",
        plan: Plan.ENTERPRISE,
      },
    }),
    prisma.school.upsert({
      where: { domain: "demo.lms.vn" },
      update: {},
      create: {
        name: "Demo School",
        domain: "demo.lms.vn",
        plan: Plan.FREE,
      },
    }),
  ]);

  const [thanglong, aiAcademy, demoSchool] = schools;
  console.log("✅ Schools created:", schools.map((s) => s.name).join(", "));

  // ─── Users ───────────────────────────────────────────────

  const usersData = [
    // Trường Thăng Long
    {
      schoolId: thanglong.id,
      email: "admin@thanglong.edu.vn",
      password: await hash("Admin@123"),
      role: Role.SCHOOL_ADMIN,
      profile: { displayName: "Nguyễn Văn Admin", phone: "0901234567" },
    },
    {
      schoolId: thanglong.id,
      email: "teacher.tuan@thanglong.edu.vn",
      password: await hash("Teacher@123"),
      role: Role.TEACHER,
      profile: { displayName: "Trần Minh Tuấn", bio: "Giáo viên Toán & Tin học, 10 năm kinh nghiệm" },
    },
    {
      schoolId: thanglong.id,
      email: "teacher.linh@thanglong.edu.vn",
      password: await hash("Teacher@123"),
      role: Role.TEACHER,
      profile: { displayName: "Lê Thị Linh", bio: "Giáo viên Tiếng Anh, IELTS 8.0" },
    },
    {
      schoolId: thanglong.id,
      email: "student.an@thanglong.edu.vn",
      password: await hash("Student@123"),
      role: Role.STUDENT,
      profile: { displayName: "Phạm Quốc An" },
    },
    {
      schoolId: thanglong.id,
      email: "student.mai@thanglong.edu.vn",
      password: await hash("Student@123"),
      role: Role.STUDENT,
      profile: { displayName: "Hoàng Thị Mai" },
    },
    {
      schoolId: thanglong.id,
      email: "student.duc@thanglong.edu.vn",
      password: await hash("Student@123"),
      role: Role.STUDENT,
      profile: { displayName: "Vũ Tiến Đức" },
    },
    {
      schoolId: thanglong.id,
      email: "parent.hung@gmail.com",
      password: await hash("Parent@123"),
      role: Role.PARENT,
      profile: { displayName: "Phạm Văn Hùng", phone: "0912345678" },
    },
    // AI Academy
    {
      schoolId: aiAcademy.id,
      email: "admin@aiacademy.vn",
      password: await hash("Admin@123"),
      role: Role.SCHOOL_ADMIN,
      profile: { displayName: "Đỗ Thành Công", bio: "Co-founder AI Academy" },
    },
    {
      schoolId: aiAcademy.id,
      email: "teacher.khoa@aiacademy.vn",
      password: await hash("Teacher@123"),
      role: Role.TEACHER,
      profile: { displayName: "Nguyễn Minh Khoa", bio: "ML Engineer, Google Brain Alumni" },
    },
    {
      schoolId: aiAcademy.id,
      email: "student.nam@aiacademy.vn",
      password: await hash("Student@123"),
      role: Role.STUDENT,
      profile: { displayName: "Lê Hoàng Nam" },
    },
    {
      schoolId: aiAcademy.id,
      email: "student.huong@aiacademy.vn",
      password: await hash("Student@123"),
      role: Role.STUDENT,
      profile: { displayName: "Trần Thị Hương" },
    },
    // Demo / Super admin
    {
      schoolId: demoSchool.id,
      email: "superadmin@lms.vn",
      password: await hash("SuperAdmin@123"),
      role: Role.SUPER_ADMIN,
      profile: { displayName: "Super Administrator" },
    },
  ];

  const createdUsers: { id: number; email: string; role: string; schoolId: number }[] = [];

  for (const { profile, ...userData } of usersData) {
    const user = await prisma.user.upsert({
      where: { schoolId_email: { schoolId: userData.schoolId, email: userData.email } },
      update: {},
      create: {
        ...userData,
        profile: { create: profile },
      },
    });
    createdUsers.push(user);
  }

  console.log(`✅ Users created: ${createdUsers.length} users`);

  const getUser = (email: string) => createdUsers.find((u) => u.email === email)!;

  // ─── Courses (Trường Thăng Long) ─────────────────────────

  const coursesData = [
    {
      schoolId: thanglong.id,
      title: "Lập trình Web cơ bản với HTML, CSS & JavaScript",
      slug: "web-co-ban",
      description:
        "Khóa học toàn diện từ HTML, CSS đến JavaScript ES6+. Phù hợp cho người mới bắt đầu muốn xây dựng website chuyên nghiệp.",
      status: CourseStatus.PUBLISHED,
      thumbnailUrl: "https://images.unsplash.com/photo-1593720213428-28a5b9e94613?w=800",
      modules: [
        {
          title: "Module 1: HTML Cơ Bản",
          order: 1,
          lessons: [
            { title: "Giới thiệu HTML & cấu trúc tài liệu", order: 1, contentType: LessonContentType.TEXT },
            { title: "Các thẻ HTML thông dụng", order: 2, contentType: LessonContentType.TEXT },
            { title: "Form và Input", order: 3, contentType: LessonContentType.VIDEO },
            { title: "Quiz: HTML Cơ Bản", order: 4, contentType: LessonContentType.QUIZ },
          ],
        },
        {
          title: "Module 2: CSS & Styling",
          order: 2,
          lessons: [
            { title: "Box Model & Flexbox", order: 1, contentType: LessonContentType.VIDEO },
            { title: "CSS Grid Layout", order: 2, contentType: LessonContentType.VIDEO },
            { title: "Responsive Design", order: 3, contentType: LessonContentType.TEXT },
            { title: "Quiz: CSS", order: 4, contentType: LessonContentType.QUIZ },
          ],
        },
        {
          title: "Module 3: JavaScript Cơ Bản",
          order: 3,
          lessons: [
            { title: "Biến, kiểu dữ liệu và toán tử", order: 1, contentType: LessonContentType.TEXT },
            { title: "Hàm và Arrow Function", order: 2, contentType: LessonContentType.VIDEO },
            { title: "DOM Manipulation", order: 3, contentType: LessonContentType.VIDEO },
            { title: "Event Handling", order: 4, contentType: LessonContentType.TEXT },
            { title: "Quiz: JavaScript", order: 5, contentType: LessonContentType.QUIZ },
          ],
        },
      ],
    },
    {
      schoolId: thanglong.id,
      title: "Tiếng Anh Giao Tiếp Thương Mại",
      slug: "tieng-anh-giao-tiep",
      description:
        "Nâng cao kỹ năng tiếng Anh trong môi trường công sở, hội nghị, đàm phán. Giáo trình chuẩn quốc tế Cambridge.",
      status: CourseStatus.PUBLISHED,
      thumbnailUrl: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=800",
      modules: [
        {
          title: "Unit 1: Introductions & Small Talk",
          order: 1,
          lessons: [
            { title: "Self-introduction in business", order: 1, contentType: LessonContentType.VIDEO },
            { title: "Small talk topics & phrases", order: 2, contentType: LessonContentType.TEXT },
            { title: "Quiz: Greetings & Introductions", order: 3, contentType: LessonContentType.QUIZ },
          ],
        },
        {
          title: "Unit 2: Meetings & Presentations",
          order: 2,
          lessons: [
            { title: "Chairing a meeting", order: 1, contentType: LessonContentType.VIDEO },
            { title: "Presentation structure & phrases", order: 2, contentType: LessonContentType.TEXT },
            { title: "Handling questions", order: 3, contentType: LessonContentType.VIDEO },
            { title: "Quiz: Meetings", order: 4, contentType: LessonContentType.QUIZ },
          ],
        },
      ],
    },
    {
      schoolId: thanglong.id,
      title: "Toán Giải Tích 12 — Ôn Thi Đại Học",
      slug: "toan-giai-tich-12",
      description:
        "Ôn thi đại học môn Toán: giới hạn, đạo hàm, tích phân, số phức. Kèm bộ đề thi thử chi tiết.",
      status: CourseStatus.DRAFT,
      thumbnailUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800",
      modules: [
        {
          title: "Chương 1: Giới hạn & Đạo hàm",
          order: 1,
          lessons: [
            { title: "Giới hạn của dãy số", order: 1, contentType: LessonContentType.TEXT },
            { title: "Đạo hàm cơ bản", order: 2, contentType: LessonContentType.VIDEO },
            { title: "Bài tập đạo hàm", order: 3, contentType: LessonContentType.INTERACTIVE },
          ],
        },
      ],
    },
    // AI Academy courses
    {
      schoolId: aiAcademy.id,
      title: "Machine Learning từ Cơ Bản đến Nâng Cao",
      slug: "machine-learning",
      description:
        "Khóa học ML toàn diện: từ Linear Regression đến Neural Networks. Thực hành với Python, scikit-learn và TensorFlow.",
      status: CourseStatus.PUBLISHED,
      thumbnailUrl: "https://images.unsplash.com/photo-1507146426996-ef05306b995a?w=800",
      modules: [
        {
          title: "Phần 1: Nền tảng ML",
          order: 1,
          lessons: [
            { title: "ML là gì? Tổng quan và ứng dụng", order: 1, contentType: LessonContentType.VIDEO },
            { title: "Python cho Data Science", order: 2, contentType: LessonContentType.TEXT },
            { title: "Numpy & Pandas cơ bản", order: 3, contentType: LessonContentType.VIDEO },
            { title: "Quiz: Nền tảng ML", order: 4, contentType: LessonContentType.QUIZ },
          ],
        },
        {
          title: "Phần 2: Supervised Learning",
          order: 2,
          lessons: [
            { title: "Linear Regression", order: 1, contentType: LessonContentType.VIDEO },
            { title: "Logistic Regression", order: 2, contentType: LessonContentType.VIDEO },
            { title: "Decision Tree & Random Forest", order: 3, contentType: LessonContentType.VIDEO },
            { title: "Lab: Dự đoán giá nhà", order: 4, contentType: LessonContentType.INTERACTIVE },
            { title: "Quiz: Supervised Learning", order: 5, contentType: LessonContentType.QUIZ },
          ],
        },
        {
          title: "Phần 3: Neural Networks",
          order: 3,
          lessons: [
            { title: "Perceptron và MLP", order: 1, contentType: LessonContentType.VIDEO },
            { title: "Backpropagation", order: 2, contentType: LessonContentType.TEXT },
            { title: "CNN — Convolutional Neural Network", order: 3, contentType: LessonContentType.VIDEO },
            { title: "Lab: Nhận diện chữ số MNIST", order: 4, contentType: LessonContentType.INTERACTIVE },
          ],
        },
      ],
    },
    {
      schoolId: aiAcademy.id,
      title: "LLM & Prompt Engineering",
      slug: "llm-prompt-engineering",
      description:
        "Làm chủ các mô hình ngôn ngữ lớn: GPT-4, Claude, Gemini. Kỹ thuật prompt engineering, RAG, fine-tuning cơ bản.",
      status: CourseStatus.PUBLISHED,
      thumbnailUrl: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800",
      modules: [
        {
          title: "Module 1: Hiểu về LLM",
          order: 1,
          lessons: [
            { title: "Transformer Architecture", order: 1, contentType: LessonContentType.VIDEO },
            { title: "GPT vs Claude vs Gemini", order: 2, contentType: LessonContentType.TEXT },
            { title: "Quiz: LLM Basics", order: 3, contentType: LessonContentType.QUIZ },
          ],
        },
        {
          title: "Module 2: Prompt Engineering",
          order: 2,
          lessons: [
            { title: "Zero-shot & Few-shot Prompting", order: 1, contentType: LessonContentType.TEXT },
            { title: "Chain-of-Thought Prompting", order: 2, contentType: LessonContentType.VIDEO },
            { title: "Prompt Templates", order: 3, contentType: LessonContentType.INTERACTIVE },
            { title: "Quiz: Prompt Engineering", order: 4, contentType: LessonContentType.QUIZ },
          ],
        },
      ],
    },
  ];

  const createdCourses: { id: number; slug: string; modules: { id: number; lessons: { id: number }[] }[] }[] = [];

  for (const { modules, ...courseData } of coursesData) {
    const course = await prisma.course.upsert({
      where: { schoolId_slug: { schoolId: courseData.schoolId, slug: courseData.slug } },
      update: {},
      create: {
        ...courseData,
        modules: {
          create: modules.map(({ lessons, ...mod }) => ({
            ...mod,
            lessons: { create: lessons },
          })),
        },
      },
      include: { modules: { include: { lessons: true } } },
    });
    createdCourses.push(course as typeof createdCourses[0]);
  }

  console.log(`✅ Courses created: ${createdCourses.length} courses`);

  // ─── Enrollments ─────────────────────────────────────────

  const enrollmentsData = [
    // Học sinh Trường Thăng Long đăng ký khóa Web
    { userId: getUser("student.an@thanglong.edu.vn").id, courseId: createdCourses[0].id },
    { userId: getUser("student.mai@thanglong.edu.vn").id, courseId: createdCourses[0].id },
    { userId: getUser("student.duc@thanglong.edu.vn").id, courseId: createdCourses[0].id },
    // Học sinh đăng ký khóa Tiếng Anh
    { userId: getUser("student.an@thanglong.edu.vn").id, courseId: createdCourses[1].id },
    { userId: getUser("student.mai@thanglong.edu.vn").id, courseId: createdCourses[1].id },
    // AI Academy students
    { userId: getUser("student.nam@aiacademy.vn").id, courseId: createdCourses[3].id },
    { userId: getUser("student.huong@aiacademy.vn").id, courseId: createdCourses[3].id },
    { userId: getUser("student.nam@aiacademy.vn").id, courseId: createdCourses[4].id },
  ];

  for (const data of enrollmentsData) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: data },
      update: {},
      create: data,
    });
  }

  console.log(`✅ Enrollments created: ${enrollmentsData.length}`);

  // ─── Gamification ─────────────────────────────────────────

  const pointsData = [
    { userId: getUser("student.an@thanglong.edu.vn").id, total: 650, level: 4 },
    { userId: getUser("student.mai@thanglong.edu.vn").id, total: 480, level: 3 },
    { userId: getUser("student.duc@thanglong.edu.vn").id, total: 120, level: 1 },
    { userId: getUser("student.nam@aiacademy.vn").id, total: 1150, level: 6 },
    { userId: getUser("student.huong@aiacademy.vn").id, total: 320, level: 2 },
  ];

  for (const data of pointsData) {
    await prisma.userPoints.upsert({
      where: { userId: data.userId },
      update: data,
      create: data,
    });
  }

  console.log(`✅ UserPoints created: ${pointsData.length}`);

  // ─── Badges ──────────────────────────────────────────────

  const badgesData = [
    {
      name: "First Step",
      description: "Hoàn thành bài học đầu tiên",
      iconUrl: "🎯",
    },
    {
      name: "Quick Learner",
      description: "Đạt 100 điểm",
      iconUrl: "⚡",
    },
    {
      name: "Dedicated Learner",
      description: "Đạt 500 điểm",
      iconUrl: "📚",
    },
    {
      name: "Quiz Master",
      description: "Đạt điểm tuyệt đối trong 5 bài quiz",
      iconUrl: "🏆",
    },
    {
      name: "AI Explorer",
      description: "Hoàn thành khóa học AI đầu tiên",
      iconUrl: "🤖",
    },
    {
      name: "Top Learner",
      description: "Đạt 1000 điểm",
      iconUrl: "🌟",
    },
    {
      name: "Streak 7",
      description: "Học liên tục 7 ngày",
      iconUrl: "🔥",
    },
    {
      name: "Completionist",
      description: "Hoàn thành 100% một khóa học",
      iconUrl: "✅",
    },
  ];

  for (const badge of badgesData) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      update: {},
      create: badge,
    });
  }

  console.log(`✅ Badges created: ${badgesData.length}`);

  // ─── Subscriptions ────────────────────────────────────────

  await prisma.subscription.upsert({
    where: { schoolId: thanglong.id },
    update: {},
    create: {
      schoolId: thanglong.id,
      plan: Plan.PRO,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2025-12-31"),
    },
  });

  await prisma.subscription.upsert({
    where: { schoolId: aiAcademy.id },
    update: {},
    create: {
      schoolId: aiAcademy.id,
      plan: Plan.ENTERPRISE,
      startDate: new Date("2024-01-01"),
    },
  });

  console.log("✅ Subscriptions created");

  // ─── Summary ─────────────────────────────────────────────

  console.log("\n─────────────────────────────────────");
  console.log("🎉 Seeding complete!\n");
  console.log("📋 Test accounts:");
  console.log("  SUPER_ADMIN  superadmin@lms.vn           / SuperAdmin@123");
  console.log("  SCHOOL_ADMIN admin@thanglong.edu.vn       / Admin@123");
  console.log("  TEACHER      teacher.tuan@thanglong.edu.vn/ Teacher@123");
  console.log("  STUDENT      student.an@thanglong.edu.vn  / Student@123");
  console.log("  ─");
  console.log("  SCHOOL_ADMIN admin@aiacademy.vn           / Admin@123");
  console.log("  TEACHER      teacher.khoa@aiacademy.vn    / Teacher@123");
  console.log("  STUDENT      student.nam@aiacademy.vn     / Student@123");
  console.log("─────────────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
