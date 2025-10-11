import { readFile, readdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcrypt';
import type { User } from '../models/users';


function isAsciiCharactersOnly(str: string): boolean {
    return /^[\x00-\x7F]*$/.test(str);
}

export class FilesystemUserRepository {
    private dataDirectoryPath: string;

    constructor(dataDirectoryPath: string) {
        this.dataDirectoryPath = dataDirectoryPath;
    }

    async getUser(username: string): Promise<User|null> {
        try {
            const filePath = path.join(this.dataDirectoryPath, username + '.json');
            const fileContent = await readFile(filePath, 'utf-8');
            const jsonData = JSON.parse(fileContent);
            return {
                username: jsonData.username,
                hashedPassword: jsonData.hashedPassword,
                likedPosts: jsonData.likedPosts,
                viewedPosts: jsonData.viewedPosts
            }
        } catch (err) {
            console.log(err);
            return null;
        }
    }

    async createUser(username: string, password: string): Promise<string> {

        if (!isAsciiCharactersOnly(username)) {
            throw new Error('Username은 ASCII 문자만 포함할 수 있습니다.');
        }

        const existingUser = await this.getUser(username);
        if (existingUser) {
            throw new Error('사용할 수 없는 username입니다.');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = {
            username: username,
            hashedPassword: hashedPassword,
            likedPosts: [],
            viewedPosts: []
        }

        const fileName = user.username + '.json';
        const filePath = path.join(this.dataDirectoryPath, fileName);


        const jsonString = JSON.stringify(user);
        await writeFile(filePath, jsonString);
        return user.username;
    }
    
    async likePost(username: string, postId: string): Promise<string[]> {
        const user = await this.getUser(username);
        if (!user) {
            throw new Error('사용자를 찾을 수 없습니다.');
        }
        user.likedPosts.push(postId);
        const fileName = user.username + '.json';
        const filePath = path.join(this.dataDirectoryPath, fileName);
        const jsonString = JSON.stringify(user);
        await writeFile(filePath, jsonString);
        return user.likedPosts;
    }

}