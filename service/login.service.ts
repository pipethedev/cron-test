import axios from "axios";

class LoginService {
  async execute({ domain, password}: {domain: string, password: string}) {
    try {
        const payload = { domain, password };
    
        const response = await axios
          .post(
            "https://api.brimble.io/v1/projects/password-protect/login",
            JSON.stringify(payload),
            {
              headers: {
                "Content-Type": "application/json"
              }
            }
          );
        
          return response.data;
    } catch (error: any) {
        throw error;
    }
  }
}

export default LoginService;