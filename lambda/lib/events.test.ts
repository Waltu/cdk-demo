import * as events from "./events";

function getAPIGatewayMock(data) {
    return {
        version: null,
        routeKey: null,
        rawPath: null,
        rawQueryString: null,
        headers: null,
        requestContext: null,
        isBase64Encoded: null,
        body: null,
        ...data
    }
}

describe("events", () => {
    test('should return event id when valid request', async () => {
        const body = JSON.stringify({ source: "EMBEDED_VIEW", type: "embed_123" });
        const res = await events.add(getAPIGatewayMock({ body }));

        const parsedResponse = JSON.parse(res as string);

        expect(parsedResponse.statusCode).toBe(200);
        expect(parsedResponse.body).toContain("id");
    });

    test('should return 400 when invalid body', async () => {
        const body = JSON.stringify({ type: "embed_123" });
        const res = await events.add(getAPIGatewayMock({ body }));

        const parsedResponse = JSON.parse(res as string);

        expect(parsedResponse.statusCode).toBe(400);
    });
});
