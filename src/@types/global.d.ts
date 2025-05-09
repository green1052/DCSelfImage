declare global {
    interface DcinsideImage {
        files: {
            name: string;
            orgin_name: string;
            size: string;
            type: string;
            width: number;
            url: string;
            _s_url: string;
            _s2_url: string;
            web2__url: string;
            delete_with_credentials: boolean;
            file_temp_no: number;
        }[];
    }

    interface Group {
        text: string;
        value: number;
        randomEnabled?: boolean;
    }

    interface Gallery {
        id: string;
        groups: number[];
    }

    interface Image {
        imageurl: string;
        filename: string;
        filesize: string;
        imagealign: "L";
        originalurl: string;
        thumburl: string;
        file_temp_no: number;
    }

    interface Settings {
        webpConversion: boolean;
        nameObfuscation: boolean;
    }
}
