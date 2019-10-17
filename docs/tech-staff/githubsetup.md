# Github Setup

*Classy is integrated with Github.com or Github Enterprise to provide interactive and gamified learning experienced for students. When a student pushes code to a Github repository, Classy gives feedback and a grade to the student. Classy, therefore, requires the appropriate permissions to access and interact with a student repository.*

## Configure Github

## Debug Github

## Integrate Github

### Github Tokens

Two Github tokens may be added to the Classy environmental configuration file. The Classy Bot Token is mandatory and the Docker AutoGrade Token is optional.

#### Classy Bot Token Steps

- Login as the bot name decided for the course (AutoBot is the standard user unless requested by instructor)
- Click on the user settings icon and click on Developer Settings.
- Click on Personal Tokens side-panel option.
- Under the Personal Tokens view, you will have the option to generate a new token or configure re-generate a pre-configured token.

WARNING: IF you decide to regenerate a pre-configured token, but the token is being used by another Classy server, you will break the course until a token is updated in the .env file for that course instance. If you lose track of the tokens, the safest way forward is to generate a new token, until the problem can be fixed at the end of the next semester.

TO DO: Screenshot of the Github access permissions for the token.

#### Docker AutoGrade Token Steps

**WARNING**: Classy can **ONLY** have one **GH_DOCKER_TOKEN** configured in the **/opt/classy/.env** file. If a course has multiple instructors who each would like to build an AutoGrade docker container to mark their assignments, they **MUST** share the token. Hence, the token should be generated from an user level that has permission to all of their AutoGrade container Github repositories. See [Instructor AutoGrade Creation Manual](/docs/instructor/autograde.md#overview) for more information on how to clone AutoGrade container repositories.

- Login as user with permissions to view the AutoGrade repository when it is private.
- Repeat the steps from [Classy Bot Token](#classy-bot-token-steps) generation above.

TO DO: Screenshot of the Github access permissions for the token.

<TO DO: Details on how the enviornmental config file should be updated should be included when you have your repository, users, and API keys created>
# Github Setup

