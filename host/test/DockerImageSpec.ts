/* tslint:disable:no-unused-expression */
import {expect} from "chai";
import DockerImage from "../src/docker/DockerImage";
import {IDockerImageProperties} from "../src/docker/DockerTypes";

describe(`DockerImage`, () => {
    let image: DockerImage;

    before(() => {
        image = new DockerImage();
    });

    describe(`build`, () => {
        after(async () => {
            try {
                await image.remove();
            } catch (err) {
                // Do nothing
            }
        });

        it(`Should create an image from a path containing a Dockerfile.`, async () => {
            const tag: string = `test-img-641`;
            const path: string = `${__dirname}/container`;
            let id: any;
            try {
                id = await image.build(tag, path);
            } catch (err) {
                id = err;
            } finally {
                expect(id).to.be.a(`string`);
                expect(id).to.have.length(12);
            }
        });
        it(`Should create an image from an URL pointing to a git repository containing a Dockerfile [Uses external resource].`, async () => {
            const tag: string = `test-img-640`;
            const url: string = `https://github.com/docker/dockercloud-hello-world.git`;
            let id: any;
            try {
                id = await image.build(tag, url);
            } catch (err) {
                id = err;
            } finally {
                expect(id).to.be.a(`string`);
                expect(id).to.have.length(12);
            }
        });
        it(`Should create an image from a Dockerfile passed as a string.`);
        it(`Should should tag the image.`, async () => {
            const tag: string = `test-img-643`;
            const path: string = `${__dirname}/container`;
            let id: any;
            try {
                id = await image.build(tag, path);
            } catch (err) {
                id = err;
            } finally {
                expect(id).to.be.a(`string`);
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
                expect(id.message).to.equal(`Command failed: docker build --tag test-img-643 --rm /does/not/exist\nunable to prepare context: path "/does/not/exist" not found\n`);
            }
        });
    });

    describe(`getProperties`, () => {
        // Duplicates IDockerImage interface
        const expectedProperties: {[propName: string]: string} = {
            id: `string`,
            repository: `string`,
            tag: `string`,
            digest: `string`,
            createdSince: `string`,
            createdAt: `string`,
            size: `string`,
        };

        it(`Should not return properties for images that do not exist.`, async () => {
            let properties: any;
            try {
                properties = await image.getProperties();
            } catch (err) {
                properties = err;
            } finally {
                expect(properties).to.be.empty;
            }
        });
        it(`Should return actual values for all properties if the image exists.`, async () => {
            let properties: any;
            try {
                await image.build(`test-img-111`, `${__dirname}/container`);
                properties = await image.getProperties();
            } catch (err) {
                properties = err;
            } finally {
                for (const [propName, type] of Object.entries(expectedProperties)) {
                    expect(properties[0]).to.have.haveOwnProperty(propName);
                    expect(properties[0][propName]).to.be.a(type);
                }
                try {
                    await image.remove();
                } catch (err) {
                    // Do nothing
                }
            }
        });
    });

    describe(`remove`, () => {
        it(`Should remove an image from DockerInstance.`, async () => {
            let id: any;
            try {
                await image.build(`test-img-222`, `${__dirname}/container`);
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
                expect(id.message).to.have.string(`Error response from daemon: No such image`);
            }
        });
    });
});
