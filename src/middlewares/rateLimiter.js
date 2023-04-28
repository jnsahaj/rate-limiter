import { RateLimiter } from "../rateLimiter.js";
import redisClient from "../redis.js";
import { DEFAULT_SCHEME, RATE_LIMITER_SCHEMES } from "../constants.js";

const rateLimiterMiddleware = async (req, res, next) => {
    try {
        const rateLimiter = new RateLimiter({ redisClient });
        const limiterParams = await redisClient.hgetall("limiterParams");

        const scheme = limiterParams.scheme || DEFAULT_SCHEME;

        let isAllowed = false;

        if (scheme === RATE_LIMITER_SCHEMES.SLIDING_WINDOW) {
            const { max_requests_per_window, window_size_in_ms } =
                limiterParams;

            isAllowed = await rateLimiter.slidingWindow({
                key: req.ip,
                maxRequestsPerWindow:
                    parseInt(max_requests_per_window) || undefined,
                windowSizeInMs: parseInt(window_size_in_ms) || undefined,
            });
        } else if (scheme === RATE_LIMITER_SCHEMES.TOKEN_BUCKET) {
            const { bucket_size, refill_rate_in_ms } = limiterParams;

            isAllowed = await rateLimiter.tokenBucket({
                key: req.ip,
                bucketSize: parseInt(bucket_size) || undefined,
                refillRateInMs: parseInt(refill_rate_in_ms) || undefined,
            });
        } else {
            throw new Error(`Unknown rate limiter scheme: ${scheme}`);
        }

        if (isAllowed) {
            return next();
        } else {
            return res.status(429).send("Too Many Requests");
        }
    } catch (error) {
        console.error(`Error in rate limiter middleware: ${error}`);
        return res.status(500).send("Internal Server Error");
    }
};

export default rateLimiterMiddleware;
