const fs = require('fs');
const filePath = require('path').join(__dirname, 'routes', 'feedback.js');
let content = fs.readFileSync(filePath, 'utf8');

if (content.includes('NEW FEEDBACK RECEIVED')) {
  console.log('Already patched');
  process.exit(0);
}

const oldStr = "const feedback = db.prepare('SELECT * FROM feedback WHERE id = ?').get(feedbackId);\n\n    res.status(201).json(formatFeedback(feedback));";
const newStr = `const feedback = db.prepare('SELECT * FROM feedback WHERE id = ?').get(feedbackId);

    // Log notification to console (dev mode email/webhook substitute)
    console.log('\\n========================================');
    console.log('NEW FEEDBACK RECEIVED');
    console.log('========================================');
    console.log('Event: ' + event.name + ' (' + eventId + ')');
    console.log('Type: ' + feedbackType);
    console.log('From: ' + userType + (sanitizedEmail ? ' (' + sanitizedEmail + ')' : ''));
    if (rating) console.log('Rating: ' + rating + '/5');
    if (sanitizedMessage) console.log('Message: ' + sanitizedMessage);
    console.log('========================================\\n');

    res.status(201).json(formatFeedback(feedback));`;

content = content.replace(oldStr, newStr);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched successfully');
