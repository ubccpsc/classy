/* tslint:disable:no-unused-expression */
import {expect} from "chai";
import DockerImage from "../src/docker/DockerImage";

describe(`DockerImage`, () => {
    let image: DockerImage;
    const properties: {[name: string]: string} = {
        id: `string`,
        repository: `string`,
        tag: `string`,
        digest: `string`,
        createdSince: `object`,  // Date object
        createdAt: `object`,     // Date object
        size: `string`
    };

    before(() => {
        image = new DockerImage();
    });

    it(`Should return undefined for all properties if the image has not been built.`, () => {
        for (const [propName, type] of Object.entries(properties)) {
            expect((image as any)[propName]).to.be.undefined;
        }
    });
    it(`Should return actual values for all properties if the image exists.`, async () => {
        try {
            await image.build(`test-img-111`, `${__dirname}/test/container`);
            for (const [propName, type] of Object.entries(properties)) {
                expect((image as any)[propName]).to.be.a(type);
            }
            await image.remove();
        } catch (err) {
            expect.fail();
        }
    });
    it(`Should return undefined for all properties if the image has been removed.`, async () => {
        try {
            await image.build(`test-img-222`, `${__dirname}/test/container`);
            await image.remove();
            for (const [propName, type] of Object.entries(properties)) {
                expect((image as any)[propName]).to.be.a(type);
            }
        } catch (err) {
            expect.fail();
        }
    });

    // it(`Should return the image ID if the image exists.`);
    // it(`Should return the image repository if the image exists.`);
    // it(`Should return the image tag if the image exists.`);
    // it(`Should return the image digest if the image exists.`);
    // it(`Should return the elapsed time since the image was created if the image exists.`);
    // it(`Should return the time the image was created if the image exists.`);
    // it(`Should return the image size if the image exists.`);
    describe(`build`, () => {
        after(async () => {
            try {
                await image.remove();
            } catch (err) {
                // Do nothing
            }
        });

        it(`Should create an image from an URL pointing to a git repository containing a Dockerfile.`, async () => {
            const tag: string = `test-img-640`;
            const url: string = ``;  // TODO Create a test repo?
            let id: any;
            try {
                id = await image.build(tag, url);
            } catch (err) {
                id = err;
            } finally {
                expect(id).to.be.a(`string`);
            }
        });
        it(`Should create an image from a path containing a Dockerfile.`, async () => {
            const tag: string = `test-img-641`;
            const path: string = `${__dirname}/test/container`;
            let id: any;
            try {
                id = await image.build(tag, path);
            } catch (err) {
                id = err;
            } finally {
                expect(id).to.be.a(`string`);
            }
        });
        it.skip(`Should create an image from a Dockerfile on stdin.`);
        it(`Should should tag the image.`, async () => {
            const tag: string = `test-img-642`;
            const path: string = `${__dirname}/test/container`;
            let id: any;
            try {
                id = await image.build(tag, path);
            } catch (err) {
                id = err;
            } finally {
                expect(image.id).to.equal(id);
            }
        });
        it(`Should reject if building the image fails.`, async () => {
            const tag: string = `test-img-643`;
            const path: string = `/does/not/exist`;
            let id: any;
            try {
                id = await image.build(tag, path);
            } catch (err) {
                id = err;
            } finally {
                expect(id).to.be.instanceof(Error);
                expect(id.message).to.equal(``);
            }
        });
    });

    describe(`remove`, () => {
        it(`Should remove an image from DockerInstance.`, async () => {
            let id: any;
            try {
                await image.build(`test-img-222`, `${__dirname}/test/container`);
                id = await image.remove();
            } catch (err) {
                id = err;
            } finally {
                expect(id).to.be.a(`string`);
            }
        });
        it(`Should reject if Docker fails to remove the image.`, async () => {
            let id: any;
            try {
                id = await image.remove();
            } catch (err) {
                id = err;
            } finally {
                expect(id).to.be.instanceof(Error);
                expect(id.message).to.equal(``);
            }
        });
    });
});
