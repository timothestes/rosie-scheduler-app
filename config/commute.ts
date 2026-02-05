// Configuration for in-person lesson commute buffer
// This buffer is added between in-person lessons to account for travel time

export interface CommuteConfig {
  // Buffer time in minutes between in-person lessons
  bufferMinutes: number;
  // Description for UI display
  description: string;
}

export const commuteConfig: CommuteConfig = {
  // 30 minutes buffer for travel between in-person lessons
  // This accounts for:
  // - Drive time between locations in the Santa Maria/Orcutt area
  // - Parking and walking to the lesson location
  // - Setup/teardown time
  bufferMinutes: 30,
  description: 'A 30-minute buffer is added between in-person lessons to allow for travel time.',
};

// Helper to get the commute buffer in milliseconds
export function getCommuteBufferMs(): number {
  return commuteConfig.bufferMinutes * 60 * 1000;
}
