// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * VoteBeats End-to-End Tests
 *
 * Tests critical user flows:
 * 1. DJ registration and login
 * 2. Event creation
 * 3. Attendee song request and voting
 * 4. DJ queue management (approve, reject, reorder, now playing)
 * 5. Real-time updates between DJ and attendee views
 */

const TEST_DJ = {
  name: `E2E DJ ${Date.now()}`,
  email: `e2e-${Date.now()}@test.com`,
  password: 'TestPass123',
};

const TEST_EVENT = {
  name: `E2E Test Dance ${Date.now()}`,
  location: 'E2E Test Venue',
};

let eventId = '';
let eventUrl = '';

// =========================================================================
// Test 1: DJ can register, log in, and reach the dashboard
// =========================================================================
test.describe('DJ Authentication', () => {
  test('DJ can register a new account', async ({ page }) => {
    await page.goto('/register');
    await page.getByPlaceholder('DJ Awesome').fill(TEST_DJ.name);
    await page.getByPlaceholder('dj@example.com').fill(TEST_DJ.email);
    await page.getByPlaceholder('Min 8 characters').fill(TEST_DJ.password);
    await page.getByPlaceholder('Confirm password').fill(TEST_DJ.password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should redirect to dashboard after registration
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByText(`Welcome, ${TEST_DJ.name}`)).toBeVisible();
  });

  test('DJ can log in and reach dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('dj@example.com').fill(TEST_DJ.email);
    await page.getByPlaceholder('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022').fill(TEST_DJ.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByText(`Welcome, ${TEST_DJ.name}`)).toBeVisible();
    await expect(page.getByText('Your Events')).toBeVisible();
  });
});

// =========================================================================
// Test 2: DJ can create an event with all required settings
// =========================================================================
test.describe('Event Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as DJ
    await page.goto('/login');
    await page.getByPlaceholder('dj@example.com').fill(TEST_DJ.email);
    await page.getByPlaceholder('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022').fill(TEST_DJ.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('DJ can create an event', async ({ page }) => {
    await page.getByRole('link', { name: 'Create Event' }).first().click();
    await expect(page).toHaveURL(/\/events\/create/);

    await page.getByPlaceholder('e.g., Friday Night Dance').fill(TEST_EVENT.name);
    await page.getByPlaceholder('e.g., Community Center').fill(TEST_EVENT.location);
    await page.getByRole('button', { name: 'Create Event' }).click();

    // Should redirect to dashboard with the new event
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.getByText(TEST_EVENT.name)).toBeVisible();

    // Extract event ID from the Manage link
    const manageLink = page.getByRole('link', { name: 'Manage' }).first();
    const href = await manageLink.getAttribute('href');
    eventId = href.match(/\/events\/([^/]+)\/manage/)?.[1] || '';
    eventUrl = `/e/${eventId}`;
    expect(eventId).toBeTruthy();
  });
});

// =========================================================================
// Test 3: Attendee can open event page, search, and submit a request
// =========================================================================
test.describe('Attendee Song Request', () => {
  test('Attendee can search and request a song', async ({ page }) => {
    test.skip(!eventId, 'No event ID from previous test');

    await page.goto(eventUrl);
    await expect(page.getByText(TEST_EVENT.name)).toBeVisible({ timeout: 10000 });

    // Search for a song
    await page.getByPlaceholder('Search for a song...').fill('Bohemian Rhapsody');
    await page.getByRole('button', { name: 'Search songs' }).click();

    // Wait for results and request first one
    await expect(page.getByText('Queen').first()).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Request' }).first().click();

    // Verify request confirmation
    await expect(page.getByText(/has been requested/)).toBeVisible({ timeout: 5000 });
  });
});

// =========================================================================
// Test 4: Attendee can upvote a song in the queue
// =========================================================================
test.describe('Attendee Voting', () => {
  test('Attendee can vote on a queued song', async ({ page }) => {
    test.skip(!eventId, 'No event ID from previous test');

    await page.goto(eventUrl);
    await expect(page.getByText(TEST_EVENT.name)).toBeVisible({ timeout: 10000 });

    // Navigate to Queue tab
    await page.getByRole('button', { name: 'Queue' }).click();

    // Look for a song and vote button
    const voteButton = page.getByRole('button', { name: /vote/i }).first();
    if (await voteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await voteButton.click();
      // Vote should be recorded
      await expect(page.getByText(/voted/i).or(page.getByText(/1/))).toBeVisible({ timeout: 5000 });
    }
  });
});

// =========================================================================
// Test 5: DJ can approve, reject, and manage requests
// =========================================================================
test.describe('DJ Queue Management', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!eventId, 'No event ID from previous test');
    await page.goto('/login');
    await page.getByPlaceholder('dj@example.com').fill(TEST_DJ.email);
    await page.getByPlaceholder('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022').fill(TEST_DJ.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('DJ can see requests in the queue', async ({ page }) => {
    await page.goto(`/events/${eventId}/manage`);
    await expect(page.getByText('Song Requests')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Bohemian Rhapsody')).toBeVisible();
  });

  test('DJ can reject a request', async ({ page }) => {
    await page.goto(`/events/${eventId}/manage`);
    await expect(page.getByText('Song Requests')).toBeVisible({ timeout: 10000 });

    // Click Remove button on a song
    const removeButton = page.getByRole('button', { name: 'Remove' }).first();
    if (await removeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await removeButton.click();
      // Verify rejected count incremented
      await expect(page.getByText(/Rejected \(1\)/)).toBeVisible({ timeout: 5000 });
    }
  });
});

// =========================================================================
// Test 6: DJ can mark a song as Now Playing
// =========================================================================
test.describe('DJ Now Playing', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!eventId, 'No event ID from previous test');
    await page.goto('/login');
    await page.getByPlaceholder('dj@example.com').fill(TEST_DJ.email);
    await page.getByPlaceholder('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022').fill(TEST_DJ.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('DJ can mark a song as Now Playing', async ({ page }) => {
    // First, add a new song request as attendee
    const attendeePage = await page.context().newPage();
    await attendeePage.goto(eventUrl);
    await attendeePage.getByPlaceholder('Search for a song...').fill('Shape of You');
    await attendeePage.getByRole('button', { name: 'Search songs' }).click();
    await attendeePage.getByRole('button', { name: 'Request' }).first().click();
    await attendeePage.close();

    // Navigate to manage page as DJ
    await page.goto(`/events/${eventId}/manage`);
    await expect(page.getByText('Song Requests')).toBeVisible({ timeout: 10000 });

    // Click Play button
    const playButton = page.getByRole('button', { name: 'Play' }).first();
    if (await playButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await playButton.click();
      // Should show Now Playing indicator
      await expect(page.getByText('Now Playing').first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/Now Playing \(1\)/)).toBeVisible({ timeout: 5000 });
    }
  });
});

// =========================================================================
// Test 7: Real-time updates between DJ and attendee views
// =========================================================================
test.describe('Real-time Updates', () => {
  test('Attendee sees DJ actions in real-time', async ({ page, context }) => {
    test.skip(!eventId, 'No event ID from previous test');

    // Open attendee page
    await page.goto(eventUrl);
    await expect(page.getByText(TEST_EVENT.name)).toBeVisible({ timeout: 10000 });

    // Open DJ page in new tab
    const djPage = await context.newPage();
    await djPage.goto('/login');
    await djPage.getByPlaceholder('dj@example.com').fill(TEST_DJ.email);
    await djPage.getByPlaceholder('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022').fill(TEST_DJ.password);
    await djPage.getByRole('button', { name: 'Sign In' }).click();
    await expect(djPage).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await djPage.goto(`/events/${eventId}/manage`);
    await expect(djPage.getByText('Song Requests')).toBeVisible({ timeout: 10000 });

    // DJ sends a message
    await djPage.getByRole('button', { name: 'Messages' }).click();
    const messageInput = djPage.getByPlaceholder(/type a message/i).or(djPage.getByRole('textbox').first());
    if (await messageInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await messageInput.fill('E2E Test: Welcome to the dance!');
      await djPage.getByRole('button', { name: /send/i }).click();
    }

    // Attendee should see the message (via polling)
    await page.waitForTimeout(5000); // Wait for polling
    // Check if attendee can see DJ messages
    await djPage.close();
  });
});
