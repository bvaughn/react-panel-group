import { intersects } from "./intersects";
import { Rectangle } from "./types";

const emptyRect = { x: 0, y: 0, width: 0, height: 0 };
const rect = { x: 25, y: 25, width: 50, height: 50 };

function forkRect(partial: Partial<Rectangle>) {
  return { ...rect, ...partial };
}

describe("intersects", () => {
  let strict = false;

  function verify(rectOne: Rectangle, rectTwo: Rectangle, expected: boolean) {
    const actual = intersects(rectOne, rectTwo, strict);

    try {
      expect(actual).toBe(expected);
    } catch (thrown) {
      console.log(
        "Expected",
        rectOne,
        "to",
        expected ? "intersect" : "not intersect",
        rectTwo,
        strict ? "in strict mode" : "in loose mode"
      );

      throw thrown;
    }
  }

  describe("loose", () => {
    beforeEach(() => {
      strict = false;
    });

    it("should handle empty rects", () => {
      verify(emptyRect, emptyRect, true);
    });

    it("should support fully overlapping rects", () => {
      verify(rect, rect, true);

      verify(rect, forkRect({ x: 35, width: 30 }), true);
      verify(rect, forkRect({ y: 35, height: 30 }), true);
      verify(
        rect,
        forkRect({
          x: 35,
          y: 35,
          width: 30,
          height: 30,
        }),
        true
      );

      verify(rect, forkRect({ x: 10, width: 100 }), true);
      verify(rect, forkRect({ y: 10, height: 100 }), true);
      verify(
        rect,
        forkRect({
          x: 10,
          y: 10,
          width: 100,
          height: 100,
        }),
        true
      );
    });

    it("should support partially overlapping rects", () => {
      const cases: Partial<Rectangle>[] = [
        { x: 0 },
        { y: 0 },

        // Loose mode only
        { x: -25 },
        { x: 75 },
        { y: -25 },
        { y: 75 },
        { x: -25, y: -25 },
        { x: 75, y: 75 },
      ];

      cases.forEach((partial) => {
        verify(forkRect(partial), rect, true);
      });
    });

    it("should support non-overlapping rects", () => {
      const cases: Partial<Rectangle>[] = [
        { x: 100 },
        { x: -100 },
        { y: 100 },
        { y: -100 },
        { x: -100, y: -100 },
        { x: 100, y: 100 },
      ];

      cases.forEach((partial) => {
        verify(forkRect(partial), rect, false);
      });
    });

    it("should support all negative coordinates", () => {
      expect(
        intersects(
          { x: -100, y: -100, width: 50, height: 50 },
          { x: -110, y: -90, width: 50, height: 50 },
          false
        )
      ).toBe(true);
    });
  });

  describe("strict", () => {
    beforeEach(() => {
      strict = true;
    });

    it("should handle empty rects", () => {
      verify(emptyRect, emptyRect, false);
    });

    it("should support fully overlapping rects", () => {
      verify(rect, rect, true);

      verify(rect, forkRect({ x: 35, width: 30 }), true);
      verify(rect, forkRect({ y: 35, height: 30 }), true);
      verify(
        rect,
        forkRect({
          x: 35,
          y: 35,
          width: 30,
          height: 30,
        }),
        true
      );

      verify(rect, forkRect({ x: 10, width: 100 }), true);
      verify(rect, forkRect({ y: 10, height: 100 }), true);
      verify(
        rect,
        forkRect({
          x: 10,
          y: 10,
          width: 100,
          height: 100,
        }),
        true
      );
    });

    it("should support partially overlapping rects", () => {
      const cases: Partial<Rectangle>[] = [{ x: 0 }, { y: 0 }];

      cases.forEach((partial) => {
        verify(forkRect(partial), rect, true);
      });
    });

    it("should support non-overlapping rects", () => {
      const cases: Partial<Rectangle>[] = [
        { x: 100 },
        { x: -100 },
        { y: 100 },
        { y: -100 },
        { x: -100, y: -100 },
        { x: 100, y: 100 },

        // Strict mode only
        { x: -25 },
        { x: 75 },
        { y: -25 },
        { y: 75 },
        { x: -25, y: -25 },
        { x: 75, y: 75 },
      ];

      cases.forEach((partial) => {
        verify(forkRect(partial), rect, false);
      });
    });

    it("should support all negative coordinates", () => {
      expect(
        intersects(
          { x: -100, y: -100, width: 50, height: 50 },
          { x: -110, y: -90, width: 50, height: 50 },
          true
        )
      ).toBe(true);
    });
  });
});
