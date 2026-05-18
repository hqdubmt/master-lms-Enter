import { transporter } from "../lib/mailer.js";

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

export async function sendWelcome(email: string, name: string): Promise<void> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #2563eb;">Welcome to Enterprise LMS, ${name}!</h1>
      <p>Your account has been created successfully. You can now log in and start learning.</p>
      <p>
        <a href="${process.env.APP_URL ?? "http://localhost:3000"}/login"
           style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;">
          Get Started
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;">If you did not create this account, please ignore this email.</p>
    </div>
  `;
  await sendEmail(email, "Welcome to Enterprise LMS", html);
}

export async function sendCourseEnrolled(
  email: string,
  courseName: string
): Promise<void> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #2563eb;">You have been enrolled!</h1>
      <p>You have been successfully enrolled in <strong>${courseName}</strong>.</p>
      <p>
        <a href="${process.env.APP_URL ?? "http://localhost:3000"}/courses"
           style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;">
          Go to Course
        </a>
      </p>
    </div>
  `;
  await sendEmail(email, `Enrolled in ${courseName}`, html);
}

export async function sendQuizResult(
  email: string,
  score: number,
  maxScore: number,
  courseName: string
): Promise<void> {
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passed = percentage >= 80;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: ${passed ? "#16a34a" : "#dc2626"};">
        Quiz Result: ${passed ? "Passed!" : "Keep Trying!"}
      </h1>
      <p>You scored <strong>${score} / ${maxScore}</strong> (${percentage}%) in <strong>${courseName}</strong>.</p>
      ${
        passed
          ? `<p style="color:#16a34a;">Congratulations on passing! Keep up the great work.</p>`
          : `<p style="color:#dc2626;">You need 80% to pass. Review the material and try again.</p>`
      }
      <p>
        <a href="${process.env.APP_URL ?? "http://localhost:3000"}/courses"
           style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;">
          Continue Learning
        </a>
      </p>
    </div>
  `;
  await sendEmail(
    email,
    `Quiz Result: ${percentage}% in ${courseName}`,
    html
  );
}
