import { describe, it, expect } from "vitest";
import { compileSessionStatsFromResponses } from "./responseService";

describe("compileSessionStatsFromResponses", () => {
  it("should return a default empty structure when responses array is empty", () => {
    const stats = compileSessionStatsFromResponses([]);
    expect(stats.totalResponses).toBe(0);
    expect(stats.avgRating).toBe(0);
    expect(stats.ratingDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    expect(stats.topComments).toEqual([]);
    expect(stats.leastRatedComments).toEqual([]);
  });

  it("should correctly compile statistics from mock responses", () => {
    const mockResponses = [
      {
        id: "resp1",
        sessionId: "session123",
        answers: [
          { questionId: "q1", type: "rating", value: 5 },
          { questionId: "q2", type: "rating", value: 4 },
          { questionId: "q3", type: "text", value: "Great session, very clear explanation!" },
          { questionId: "q4", type: "topics", value: "React hooks, useEffect" }
        ]
      },
      {
        id: "resp2",
        sessionId: "session123",
        answers: [
          { questionId: "q1", type: "rating", value: 4 },
          { questionId: "q2", type: "rating", value: 3 },
          { questionId: "q3", type: "text", value: "Good but went a bit fast." },
          { questionId: "q4", type: "topics", value: "React hooks" }
        ]
      }
    ];

    const mockQuestions = [
      { id: "q1", category: "Teaching Quality" },
      { id: "q2", category: "Communication" }
    ];

    const stats = compileSessionStatsFromResponses(mockResponses, mockQuestions, "session123");

    expect(stats.totalResponses).toBe(2);
    expect(stats.avgRating).toBe(4); // ( (5+4)/2 + (4+3)/2 ) / 2 = (4.5 + 3.5)/2 = 4
    expect(stats.ratingDistribution).toBeDefined();
    expect(stats.topicsLearned.length).toBeGreaterThan(0);
  });
});
