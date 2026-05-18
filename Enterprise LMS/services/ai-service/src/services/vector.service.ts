import { QdrantClient } from "@qdrant/js-client-rest";

export interface SearchResult {
  id: string;
  score: number;
  payload: {
    type: string;
    schoolId: number;
    content: string;
  };
}

const COLLECTION_NAME = "lms-content";
const VECTOR_SIZE = 1536;

export class VectorService {
  private client: QdrantClient;

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL ?? "http://localhost:6333",
      apiKey: process.env.QDRANT_API_KEY || undefined,
    });
  }

  async ensureCollection(): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

      if (!exists) {
        await this.client.createCollection(COLLECTION_NAME, {
          vectors: {
            size: VECTOR_SIZE,
            distance: "Cosine",
          },
        });
        console.log(`[VectorService] Created collection: ${COLLECTION_NAME}`);
      }
    } catch (err) {
      console.error("[VectorService] ensureCollection error:", err);
      throw err;
    }
  }

  async upsert(
    id: string,
    vector: number[],
    payload: { type: string; schoolId: number; content: string }
  ): Promise<void> {
    await this.client.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id,
          vector,
          payload,
        },
      ],
    });
  }

  async search(vector: number[], schoolId: number, limit = 5): Promise<SearchResult[]> {
    const results = await this.client.search(COLLECTION_NAME, {
      vector,
      limit,
      filter: {
        must: [
          {
            key: "schoolId",
            match: { value: schoolId },
          },
        ],
      },
      with_payload: true,
    });

    return results.map((r) => ({
      id: String(r.id),
      score: r.score,
      payload: r.payload as SearchResult["payload"],
    }));
  }
}
