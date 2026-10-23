import Log from "@common/Log";

/**
 * Created by rtholmes on 2017-10-04.
 *
 * What is left of a 2017 prototype network layer. The rest of it -- detectUnauthenticated,
 * remotePost, getRemotePost, httpPost, httpPut, httpGet, handleRemote, handleRemoteText and a
 * getData that returned hard-coded 2010 fixture data -- sat commented out here until 26W1, about
 * 415 of the file's 448 lines. None of it recorded a decision worth keeping: the views call fetch
 * directly and report failures through UI.showError, so those methods were superseded rather than
 * paused. Git has them if anyone ever wants them back.
 *
 * Only file upload still routes through here, because multipart posts need the Content-Type
 * handling below.
 */
export class Network {
	public static async httpPostFile(url: string, opts: any, formData: FormData): Promise<Response> {
		Log.trace("Network::httpPostFile( " + url + " ) - start");

		const headers: { [header: string]: string } = {};
		if (opts !== null && typeof opts === "object" && typeof opts.headers === "object" && opts.headers !== null) {
			for (const name of Object.keys(opts.headers)) {
				if (name.toLowerCase() === "content-type") {
					Log.trace("Network::httpPostFile( " + url + " ) - dropping caller Content-Type: " + opts.headers[name]);
					continue;
				}
				headers[name] = opts.headers[name];
			}
		}

		// opts is still merged for any other fields it carries, but the sanitized headers win
		const postOptions: {} = Object.assign({ method: "post", cors: "enabled", body: formData }, opts, { headers: headers });

		try {
			const data = await fetch(url, postOptions);
			Log.trace("Network::httpPostFile( " + url + " ) - success");
			return data;
		} catch (err) {
			Log.trace("Network::httpPostFile( " + url + " ) - ERROR " + err);
			throw err;
		}
	}
}
