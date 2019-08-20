## ISSUES:
## Can not re-run script. Org must be deleted and re-made to re-run

## NOTE: Must choose a maintainer who is an admin on GH Enterprise on Enterprise, 
## OR Organization owner on Github.com public website.

## NOTE: Username teams are setup to work with CI test logic. Some atest-xx users are admins and staff in random 
## places. Ideally, the randomness should be cleaned up in Classy and updated in this script.

from pprint import pprint
from dotenv import load_dotenv
import requests
import time
import json
import git
import os
import shutil

load_dotenv('./.env')


org_name = 'TEST_SCRIPT_ORG'
org_login = 'TESTSCRIPTORG'
api_token = os.getenv('GH_BOT_TOKEN').split("token ",1)[1] 
api_base_uri = 'https://github.students.cs.ubc.ca/api/v3'
github_url = 'https://github.students.cs.ubc.ca'
headers = {'Content-Type': 'application/json',
			'Authorization': 'token {0}'.format(api_token)}
maintainer = 'steca'
admin_team_members = ['atest-03', 'atest-09', 'autobot', 'classytest-admin', 'steca']
staff_team_members = ['atest-08', 'atest-09', 'classytest-admstaff', 'classytest-staff']
students_team_members = ['atest-01', 'atest-02', 'atest-03', 'atest-04', 'atest-05', 'atest-06', 'atest-07', 'atest-08',
	'atest-09', 'atest-10']

def make_organization(org_name, maintainer):
	endpoint_url = api_base_uri + '/admin/organizations';
	data = json.dumps({
		'login': org_login,
		'admin': maintainer,
		'profile_name': org_name
	})
	response = requests.post(endpoint_url, data=data, headers=headers)
	handle_response(response, endpoint_url)


def create_repo(name, description):
	endpoint_url = api_base_uri + '/orgs/' + org_login + '/repos'
	data = json.dumps({
		'name': name,
		'description': description,
		'private': False
	})
	response = requests.post(endpoint_url, data=data, headers=headers)
	handle_response(response, endpoint_url)

def get_test_repos():
	postTestRepo = git.cmd.Git('https://github.students.cs.ubc.ca/classytest/PostTestDoNotDelete.git')
	cloneTestRepo = git.cmd.Git('https://github.students.cs.ubc.ca/classytest/TESTING_SAMPLE_REPO.git')	

def create_team(team_name, team_members):
	endpoint_url = api_base_uri + '/orgs/' + org_login + '/teams'
	print(team_members)
	data = json.dumps({
		'name': team_name,
		'maintainers': team_members,
		'permission': 'pull'
	})
	response = requests.post(endpoint_url, data=data, headers=headers)
	handle_response(response, endpoint_url)

def handle_response(response, endpoint_url):
	if response.status_code >= 200 and response.status_code < 300:
		print(response.status_code)
		print(response.json())
		print(endpoint_url + 'succeeded')
	else: 
		print(response.status_code)
		print(response.json())
		print(endpoint_url + ' failed')

def add_org_members(org_members):
	endpoint_url = api_base_uri + '/orgs/' + org_login + '/memberships/'
	for member in org_members:
		data = json.dumps({})
		response = requests.put(endpoint_url + member, data=data, headers=headers)
		handle_response(response, endpoint_url)

## 1. Make Organization
##
## NOTE: ONLY WORKS ON GH ENTERPRISE
## CANNOT make orgnaization VIA API on public Github.com (create manually and comment out step #1)
##
make_organization(org_name, maintainer)

# 2. Creates 'admin', 'staff', and 'students' teams
create_team('staff', staff_team_members)
create_team('admin', admin_team_members)
create_team('students', students_team_members)

## 3. Add team members to organization (REQUIRED before adding to teams)
add_org_members(staff_team_members)
add_org_members(admin_team_members)
add_org_members(students_team_members)

## 4. Create empty repos used in CI testing
create_repo('PostTestDoNotDelete', 'Tests the AutoTest bot can comment code to a repository')
create_repo('TESTING_SAMPLE_REPO', 'To test that the AutoTest bot can successfully clone a repo with its files')

## 5a. Copy base repo code to empty repos
postTestBaseRepo = git.Repo.clone_from('https://github.students.cs.ubc.ca/classytest/PostTestDoNotDelete.git', os.path.join('./', 'PostTestDoNotDelete'))
postTestBaseRepo.delete_remote('origin')
postTestBaseRepo.create_remote('origin', github_url + '/' + org_login + '/PostTestDoNotDelete.git')
postTestBaseRepo.git.push('origin', 'master')

cloneTestBaseRepo = git.Repo.clone_from('https://github.students.cs.ubc.ca/classytest/TESTING_SAMPLE_REPO.git', os.path.join('./', 'TESTING_SAMPLE_REPO'))
cloneTestBaseRepo.delete_remote('origin')
cloneTestBaseRepo.create_remote('origin', github_url + '/' + org_login + '/TESTING_SAMPLE_REPO.git')
cloneTestBaseRepo.git.push('origin', 'master')

## 5b. clean-up filesystem cloning
shutil.rmtree('./PostTestDoNotDelete')
shutil.rmtree('./TESTING_SAMPLE_REPO')



