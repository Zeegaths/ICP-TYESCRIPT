import { v4 as uuidv4 } from 'uuid';
import { Server, StableBTreeMap, ic } from 'azle';
import express, { Request, Response } from 'express';

/**
 * This type represents a beat that can be sold on the platform.
 */
interface Beat {
    id: string;
    title: string;
    artist: string;
    price: number;
    url: string;
    createdAt: Date;
    updatedAt: Date | null;
    sold: boolean;
    featured: boolean; // New field to mark a beat as featured
}

/**
 * `beatsStorage` - it's a key-value data structure used to store beats.
 * {@link StableBTreeMap} is a self-balancing tree that acts as a durable data storage that keeps data across canister upgrades.
 * For this contract, we've chosen {@link StableBTreeMap} for the following reasons:
 * - `insert`, `get`, and `remove` operations have a constant time complexity - O(1)
 * - data stored in the map survives canister upgrades, unlike using HashMap where data is stored in the heap and lost after the canister is upgraded
 *
 * Breakdown of the `StableBTreeMap<string, Beat>` data structure:
 * - the key of the map is a `beatId`
 * - the value in this map is a beat itself `Beat` that is related to a given key (`beatId`)
 *
 * Constructor values:
 * 1) 0 - memory id where to initialize a map.
 */
const beatsStorage = StableBTreeMap<string, Beat>(0);

/**
 * Utility function to generate a standard response.
 */
const generateRes = (res: Response, status: number, data: any) => {
    return res.status(status).json({ status, ...data });
};

/**
 * Utility function to find a beat by ID.
 */
const beatFinder = (id: string) => beatsStorage.get(id);

/**
 * Function to get the current date from the Internet Computer.
 */
function getCurrentDate(): Date {
    const timestamp = new Number(ic.time());
    return new Date(timestamp.valueOf() / 1000_000);
}

export default Server(() => {
    const app = express();
    app.use(express.json());

    /**
     * Route to create a new beat.
     */
    app.post("/beats", (req: Request, res: Response) => {
        const beat: Beat = { id: uuidv4(), createdAt: getCurrentDate(), ...req.body, updatedAt: null, sold: false, featured: false };
        beatsStorage.insert(beat.id, beat);
        
        return generateRes(res, 201, beat);
    });

    /**
     * Route to get all beats.
     */
    app.get("/beats", (req: Request, res: Response) => {
        return generateRes(res, 200, beatsStorage.values());
    });

    /**
     * Route to get a specific beat by ID.
     */
    app.get("/beats/:id", (req: Request, res: Response) => {
        const beatId = req.params.id;
        const beatOpt = beatFinder(beatId);
        if ("None" in beatOpt) {
            return res.status(404).send(`The beat with id=${beatId} not found`);
        } else {
            return generateRes(res, 200, beatOpt.Some);
        }
    });

    /**
     * Route to update a specific beat by ID.
     */
    app.put("/beats/:id", (req: Request, res: Response) => {
        const beatId = req.params.id;
        const beatOpt = beatFinder(beatId);
        if ("None" in beatOpt) {
            return res.status(400).send(`Couldn't update the beat with id=${beatId}. Beat not found`);
        } else {
            const beat = beatOpt.Some;
            const updatedBeat: Beat = { ...beat, ...req.body, updatedAt: getCurrentDate() };
            beatsStorage.insert(beat.id, updatedBeat);
            return generateRes(res, 200, updatedBeat);
        }
    });

    /**
     * Route to delete a specific beat by ID.
     */
    app.delete("/beats/:id", (req: Request, res: Response) => {
        const beatId = req.params.id;
        const deletedBeat = beatsStorage.remove(beatId);
        if ("None" in deletedBeat) {
            return res.status(400).send(`Couldn't delete the beat with id=${beatId}. Beat not found`);
        } else {
            return generateRes(res, 200, deletedBeat.Some);
        }
    });

    /**
     * Route to buy a specific beat by ID.
     */
    app.post("/beats/:id/buy", (req: Request, res: Response) => {
        const beatId = req.params.id;
        const beatOpt = beatFinder(beatId);
        if ("None" in beatOpt) {
            return res.status(404).send(`The beat with id=${beatId} not found`);
        } else {
            let beat = beatOpt.Some;
            if (beat.sold) {
                return res.status(400).send(`The beat with id=${beatId} is already sold`);
            } else {
                beat = { ...beat, sold: true, updatedAt: getCurrentDate() };
                beatsStorage.insert(beat.id, beat);
                return generateRes(res, 200, beat);
            }
        }
    });

    /**
     * Route to search beats by artist.
     */
    app.get("/beats/search/artist/:artist", (req: Request, res: Response) => {
        const artist = req.params.artist.toLowerCase();
        const beats = beatsStorage.values().filter(beat => beat.artist.toLowerCase().includes(artist));
        return generateRes(res, 200, beats);
    });

    /**
     * Route to search beats by title.
     */
    app.get("/beats/search/title/:title", (req: Request, res: Response) => {
        const title = req.params.title.toLowerCase();
        const beats = beatsStorage.values().filter(beat => beat.title.toLowerCase().includes(title));
        return generateRes(res, 200, beats);
    });

    /**
     * Route to mark a beat as featured.
     */
    app.post("/beats/:id/feature", (req: Request, res: Response) => {
        const beatId = req.params.id;
        const beatOpt = beatFinder(beatId);
        if ("None" in beatOpt) {
            return res.status(404).send(`The beat with id=${beatId} not found`);
        } else {
            let beat = beatOpt.Some;
            beat = { ...beat, featured: true, updatedAt: getCurrentDate() };
            beatsStorage.insert(beat.id, beat);
            return generateRes(res, 200, beat);
        }
    });

    const PORT = 4000;
    return app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});
